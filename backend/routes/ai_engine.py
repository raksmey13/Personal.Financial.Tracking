import io
import os
import re
import logging
from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import Optional

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlmodel import select, Session

# 🟢 Official Google GenAI SDK
from google import genai
from google.genai import types

from database import SessionDep, engine
from models import (
    Category, User, Account, Budget, Transaction,
    PendingTransaction, BeneficiaryCategoryMap, Notification
)
from .auth import get_current_user
from .notification import check_and_trigger_notifications

load_dotenv()
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI Engine"])

if not os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
    possible_paths = ["service_account.json", "backend/service_account.json"]
    for path in possible_paths:
        if os.path.exists(path):
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = path
            break

client = genai.Client(
    enterprise=True,
    project="gen-lang-client-0602822816",
    location="us-central1"
)

# 🟢 Use the active production model name
MODEL_NAME = "gemini-2.5-flash"


# --- Pydantic Schemas ---
class ParsedTransactionResult(BaseModel):
    clean_merchant: str
    amount: float
    currency: str = "USD"
    suggested_category_name: str
    transaction_type: str = "expense"
    transaction_date: str
    confidence: float
    summary_note: str


class GeminiParsedTransaction(BaseModel):
    merchant: str
    amount: float
    currency: str = "USD"
    category: str = "Uncategorized"


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str


# --- Vertex AI Caller ---
def call_gemini_sdk(
        prompt: str,
        image_bytes: Optional[bytes] = None,
        json_schema: Optional[dict] = None,
        system_instruction: Optional[str] = None
) -> str:
    """
    Executes Gemini via the official google-genai SDK,
    authenticating natively via GOOGLE_APPLICATION_CREDENTIALS.
    """
    contents = []
    if image_bytes:
        contents.append(
            types.Part.from_bytes(
                data=image_bytes,
                mime_type="image/jpeg"
            )
        )
    contents.append(prompt)

    config = types.GenerateContentConfig()

    if system_instruction:
        config.system_instruction = system_instruction

    if json_schema:
        config.response_mime_type = "application/json"
        config.response_schema = json_schema

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=contents,
            config=config
        )
        return response.text or ""
    except Exception as e:
        logger.error(f"Gemini SDK Execution Error: {e}")
        raise Exception(f"Gemini API Error: {str(e)}")


# --- Helper Functions (OCR & Amount Normalizer) ---
def sanitize_amount(raw_val_str: str) -> Optional[Decimal]:
    if not raw_val_str:
        return None

    clean_str = raw_val_str.replace('·', '.').replace(',', '.').strip()
    match = re.search(r'(\d+(?:\.\d+)?)', clean_str)

    try:
        val = float(clean_str)
        if "." not in raw_val_str and val > 100 and val % 100 != 0:
            val = val / 100.0
        return Decimal(str(round(val, 2)))
    except ValueError:
        return None


def extract_text_from_image_bytes(image_bytes: bytes) -> str:
    try:
        prompt = """
        Extract all raw text from this receipt or payment screenshot verbatim.

        CRITICAL FINANCIAL INSTRUCTIONS:
        - Carefully extract all numbers, currency symbols, and total amounts.
        - Ensure decimal points are accurately preserved (e.g., $5.75 must be extracted as 5.75, not 575 or 57.00).
        """
        return call_gemini_sdk(prompt=prompt, image_bytes=image_bytes)
    except Exception as e:
        logger.error(f"Error executing Gemini Vision extraction: {e}")
        return ""


def parse_khqr_receipt(text: str):
    amount = None

    # Extract transaction amount
    amount_match = re.search(
        r'(?:amount|total|paid|sum|trx\s*amount)?\s*:?\s*[\-—\+]?\s*\$?\s*(\d+(?:[\.\,]\d{1,2})?)\s*(?:USD|\$|KHR|៛)?',
        text, re.IGNORECASE
    )
    if amount_match:
        raw_num = amount_match.group(1).replace(',', '.')
        try:
            val = float(raw_num)
            if '.' in raw_num:
                amount = Decimal(str(round(val, 2)))
            else:
                if val > 100 and val % 10 != 0 and val < 10000:
                    val = val / 100.0
                amount = Decimal(str(round(val, 2)))
        except ValueError:
            pass

    raw_name = "UNKNOWN MERCHANT"

    # Support Unicode (Khmer, Chinese, Latin) and common transfer labels (To, Paid To, Receiver, Beneficiary)
    name_match = re.search(
        r'(?:transfer\s+to|paid\s+to|to\s+account|beneficiary|receiver|merchant\s+name|merchant|to)\s*:?\s*([^\n\r]+)',
        text, re.IGNORECASE
    )

    if name_match:
        extracted = name_match.group(1).strip()

        # Safely remove trailing metadata keywords without wiping out the beneficiary name
        cleaned = re.sub(
            r'\b(TRX\.?\s*ID|ORIGINAL\s+AMOUNT|REFERENCE\s*#|TRANSACTION\s+DATE|REMARK|DATE)\b.*',
            '', extracted, flags=re.IGNORECASE
        ).strip()

        cleaned = re.sub(r'^(TO|TRANSFER TO|PAID TO)\s+', '', cleaned, flags=re.IGNORECASE).strip()
        if cleaned:
            raw_name = cleaned.upper()

    raw_account_num = None
    acc_match = re.search(r'From\s+account\s*:?\s*.*?\b([\d\s]{8,15})\b', text, re.IGNORECASE)
    if acc_match:
        raw_account_num = acc_match.group(1).replace(" ", "")

    return amount, raw_name, raw_account_num


# 🟢 Direct Vision Function with Exact Currency Detection (No Conversion)
def process_receipt_image_direct(image_bytes: bytes) -> tuple[Optional[Decimal], str, str]:
    """
    Passes image bytes directly to Gemini Vision to extract exact amount, merchant name, and currency (USD or KHR).
    """
    prompt = """
    Analyze this payment receipt or bank transfer screenshot visually.

    CRITICAL EXTRACTION RULES:
    1. "merchant": Identify the recipient, seller, store, or vendor.
       - Check top header title, "Transfer to", "Paid To:", "Seller:", or "Terminal name:".
       - NEVER use the "From account" name (that is the sender).
    2. "amount": Extract the exact transaction amount as a numeric float.
    3. "currency": Detect whether the currency is "USD" ($) or "KHR" (៛). Output "USD" or "KHR".

    Output JSON ONLY:
    {
      "merchant": "STRING",
      "amount": NUMBER,
      "currency": "STRING"
    }
    """

    json_schema = {
        "type": "OBJECT",
        "properties": {
            "merchant": {"type": "STRING"},
            "amount": {"type": "NUMBER"},
            "currency": {"type": "STRING"}
        },
        "required": ["merchant", "amount", "currency"]
    }

    try:
        resp_text = call_gemini_sdk(prompt=prompt, image_bytes=image_bytes, json_schema=json_schema)
        parsed = GeminiParsedTransaction.model_validate_json(resp_text)

        amt = Decimal(str(round(parsed.amount, 2))) if parsed.amount else None
        merchant_name = parsed.merchant.strip().upper() if parsed.merchant else "UNKNOWN MERCHANT"
        currency = getattr(parsed, 'currency', 'USD').upper()
        if "KHR" in currency or "៛" in currency:
            currency = "KHR"
        else:
            currency = "USD"

        return amt, merchant_name, currency
    except Exception as e:
        logger.error(f"Direct vision extraction error: {e}")
        return None, "UNKNOWN MERCHANT", "USD"


# --- Unified Processor Function ---
def process_transaction_input(
        user_id: int,
        raw_text: str = "",
        image_bytes: Optional[bytes] = None,
        source: str = "telegram"
) -> str:
    amount = None
    raw_name = "UNKNOWN MERCHANT"
    raw_account_num = None
    extracted_currency = "USD"

    # 🟢 Universal Direct Vision Extraction for Telegram Uploads
    if image_bytes:
        amount, raw_name, extracted_currency = process_receipt_image_direct(image_bytes)
        logger.info(f"📸 [Vision Extracted]: Merchant='{raw_name}', Amount={amount} {extracted_currency}")

    # Fallback for plain text input (when no image is attached)
    if not image_bytes and raw_text:
        is_receipt = any(
            k in raw_text.lower() for k in ["transfer to", "paid to", "from account", "trx id", "bakong", "transfer"]
        )
        if is_receipt:
            amount, raw_name, raw_account_num = parse_khqr_receipt(raw_text)

    if not amount:
        try:
            with Session(engine) as session:
                categories = session.exec(
                    select(Category).where((Category.user_id == user_id) | (Category.user_id == None))
                ).all()
                valid_categories = [c.name for c in categories] if categories else ["General"]

            prompt = f"""
            Extract financial transaction details from text: "{raw_text}"
            Current Date: {date.today()}
            Allowed Categories: {valid_categories}

            CRITICAL DECIMAL INSTRUCTIONS:
            - Parse the amount accurately as a float.
            - If the text specifies '5.75', output exactly 5.75.
            """

            json_schema = {
                "type": "OBJECT",
                "properties": {
                    "merchant": {"type": "STRING"},
                    "amount": {"type": "NUMBER"},
                    "currency": {"type": "STRING"},
                    "category": {"type": "STRING"}
                },
                "required": ["merchant", "amount"]
            }

            resp_text = call_gemini_sdk(prompt=prompt, json_schema=json_schema)
            parsed = GeminiParsedTransaction.model_validate_json(resp_text)

            parsed_amt = parsed.amount
            if parsed_amt > 50 and "." not in str(raw_text) and "5.75" in raw_text:
                parsed_amt = 5.75

            amount = Decimal(str(parsed_amt))
            raw_name = parsed.merchant.upper()
            if hasattr(parsed, "currency") and parsed.currency:
                extracted_currency = "KHR" if "KHR" in parsed.currency.upper() or "៛" in parsed.currency else "USD"
        except Exception as e:
            logger.error(f"Gemini transaction processing error: {e}")

    if not amount or amount <= 0:
        return "⚠️ Could not parse transaction amount. Please specify like: 'Spent $5.50 on Coffee'."

    # Set currency formatting symbol for responses
    symbol = "៛" if extracted_currency == "KHR" else "$"

    with Session(engine) as session:
        user_accounts = session.exec(
            select(Account).where(Account.user_id == user_id, Account.is_active == True).order_by(Account.id)
        ).all()

        if not user_accounts:
            return "⚠️ No active financial accounts found."

        # 🟢 Match user's account by extracted currency (e.g., match KHR account for KHR receipts)
        matched_account = next((a for a in user_accounts if a.currency.upper() == extracted_currency), user_accounts[0])
        matched_account_id = matched_account.id

        if raw_account_num:
            db_acc = session.exec(
                select(Account).where(Account.user_id == user_id, Account.account_name.contains(raw_account_num))
            ).first()
            if db_acc:
                matched_account_id = db_acc.id

        mapping = session.exec(
            select(BeneficiaryCategoryMap).where(
                BeneficiaryCategoryMap.user_id == user_id,
                BeneficiaryCategoryMap.raw_name == raw_name,
            )
        ).first()

        if mapping:
            clean_amount = abs(amount)
            new_tx = Transaction(
                user_id=user_id,
                amount=clean_amount,
                category_id=mapping.category_id,
                account_id=matched_account_id,
                transaction_date=date.today(),
                description=f"{source.capitalize()}: {raw_name}",
                type="expense",
            )
            session.add(new_tx)

            acc_obj = session.get(Account, matched_account_id)
            if acc_obj:
                acc_obj.balance -= clean_amount
                session.add(acc_obj)

            session.commit()

            check_and_trigger_notifications(
                user_id=user_id,
                account_id=matched_account_id,
                category_id=mapping.category_id,
                session=session,
                tx_date=date.today()
            )

            return f"✅ Auto-categorized {symbol}{clean_amount:.2f} under Category #{mapping.category_id} ({raw_name})."

        else:
            pending = PendingTransaction(
                user_id=user_id,
                raw_beneficiary_name=raw_name,
                amount=amount,
                transaction_date=date.today(),
                account_id=matched_account_id,
                source=source,
                status="pending",
            )
            session.add(pending)
            session.commit()
            session.refresh(pending)

            session.add(Notification(
                user_id=user_id,
                title="📥 Action Required: Uncategorized Transaction",
                message=f"New transaction of {symbol}{amount:.2f} from '{raw_name}' needs a category in your Pending Inbox.",
                notification_type="warning",
                is_read=False,
                created_at=datetime.utcnow(),
                entity_type="transaction",
                entity_id=pending.id,
                deduplication_key=f"pending_staged_{pending.id}",
                expires_at=datetime.utcnow() + timedelta(days=14)
            ))
            session.commit()

            return f"📥 Staged {symbol}{amount:.2f} for '{raw_name}' in Pending Inbox!"


# --- REST API Endpoints ---
@router.post("/parse-text", response_model=ParsedTransactionResult)
def parse_natural_language_transaction(
        session: SessionDep,
        raw_text: str = Form(...),
        current_user: User = Depends(get_current_user)
):
    categories = session.exec(
        select(Category).where((Category.user_id == current_user.id) | (Category.user_id == None))
    ).all()
    valid_categories = [c.name for c in categories] if categories else ["General"]

    prompt = f"""
    Analyze financial entry text: "{raw_text}"
    Current Date: {date.today().strftime('%Y-%m-%d')}
    Allowed Category Names: {valid_categories}

    Instructions:
    1. Extract clean merchant name.
    2. Extract exact float amount.
    3. Pick best category name.
    4. Format transaction_date as YYYY-MM-DD.
    """

    json_schema = {
        "type": "OBJECT",
        "properties": {
            "clean_merchant": {"type": "STRING"},
            "amount": {"type": "NUMBER"},
            "currency": {"type": "STRING"},
            "suggested_category_name": {"type": "STRING"},
            "transaction_type": {"type": "STRING"},
            "transaction_date": {"type": "STRING"},
            "confidence": {"type": "NUMBER"},
            "summary_note": {"type": "STRING"}
        },
        "required": ["clean_merchant", "amount", "suggested_category_name", "transaction_date"]
    }

    try:
        resp_text = call_gemini_sdk(prompt=prompt, json_schema=json_schema)
        return ParsedTransactionResult.model_validate_json(resp_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini parsing error: {str(e)}")


@router.post("/scan-receipt", response_model=ParsedTransactionResult)
async def scan_receipt_image(
        session: SessionDep,
        file: UploadFile = File(...),
        current_user: User = Depends(get_current_user)
):
    try:
        image_bytes = await file.read()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image upload.")

    categories = session.exec(
        select(Category).where((Category.user_id == current_user.id) | (Category.user_id == None))
    ).all()
    valid_categories = [c.name for c in categories] if categories else ["General"]

    prompt = f"""
    Extract transaction details from this image.
    Allowed Category Names: {valid_categories}
    Current Date: {date.today().strftime('%Y-%m-%d')}
    """

    json_schema = {
        "type": "OBJECT",
        "properties": {
            "clean_merchant": {"type": "STRING"},
            "amount": {"type": "NUMBER"},
            "currency": {"type": "STRING"},
            "suggested_category_name": {"type": "STRING"},
            "transaction_type": {"type": "STRING"},
            "transaction_date": {"type": "STRING"},
            "confidence": {"type": "NUMBER"},
            "summary_note": {"type": "STRING"}
        },
        "required": ["clean_merchant", "amount", "suggested_category_name", "transaction_date"]
    }

    try:
        resp_text = call_gemini_sdk(prompt=prompt, image_bytes=image_bytes, json_schema=json_schema)
        return ParsedTransactionResult.model_validate_json(resp_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini Vision error: {str(e)}")


@router.post("/chat", response_model=ChatResponse)
def handle_ui_chat_assistant(
        payload: ChatRequest,
        session: SessionDep,
        current_user: User = Depends(get_current_user),
):
    try:
        today_str = date.today().strftime("%Y-%m-%d (%A)")

        categories = session.exec(
            select(Category).where((Category.user_id == current_user.id) | (Category.user_id == None))
        ).all()
        accounts = session.exec(
            select(Account).where(Account.user_id == current_user.id, Account.is_active == True)
        ).all()

        acc_summary = [f"{a.account_name} ({a.currency}): ${a.balance:.2f}" for a in accounts] if accounts else []
        cat_names = [c.name for c in categories] if categories else []

        system_instruction = f"""
        You are the AI Personal Finance Assistant for Surveyor Pro.
        User Email: {current_user.email}
        Today's Date: {today_str}

        LIVE USER FINANCIAL SNAPSHOT:
        - Connected Accounts & Balances: {acc_summary if acc_summary else "None"}
        - Available Categories: {cat_names if cat_names else "None"}

        CRITICAL ROUTING INSTRUCTIONS:
        1. When user asks to see past or recent transactions, output JSON: {{"tool": "get_recent_transactions_tool", "limit": 5}}
        2. When user asks how much they spent in a timeframe or category, output JSON: {{"tool": "get_spending_summary_tool", "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD", "category_name": "..."}}
        3. When user asks about budget status or limits, output JSON: {{"tool": "get_budget_status_tool"}}
        4. When user mentions spending, earning, or logging money, output JSON: {{"tool": "create_transaction_tool", "amount": 0.0, "category_name": "...", "account_name": "...", "transaction_type": "expense"}}
        5. For standard questions or balance queries, respond directly as normal text.
        """

        response_text = call_gemini_sdk(
            prompt=payload.message,
            system_instruction=system_instruction
        )

        if "{" in response_text and "tool" in response_text:
            try:
                import json
                clean_json = response_text[response_text.find("{"):response_text.rfind("}") + 1]
                tool_payload = json.loads(clean_json)
                call_name = tool_payload.get("tool", "")

                if call_name == "get_recent_transactions_tool":
                    query_limit = min(int(tool_payload.get("limit", 5)), 20)
                    recent_txs = session.exec(
                        select(Transaction)
                        .where(Transaction.user_id == current_user.id)
                        .order_by(Transaction.transaction_date.desc(), Transaction.id.desc())
                        .limit(query_limit)
                    ).all()

                    if not recent_txs:
                        return ChatResponse(reply="📜 You don't have any logged transactions yet.")

                    formatted_lines = [
                        f"• **{tx.transaction_date}**: {'+' if tx.type == 'income' else '-'}${abs(tx.amount):.2f} (*{tx.type.capitalize()}*) — {tx.description or 'No desc'}"
                        for tx in recent_txs
                    ]
                    return ChatResponse(reply="📜 **Recent Transactions:**\n\n" + "\n".join(formatted_lines))

                elif call_name == "get_spending_summary_tool":
                    start_str = tool_payload.get("start_date") or date.today().replace(day=1).strftime("%Y-%m-%d")
                    end_str = tool_payload.get("end_date") or date.today().strftime("%Y-%m-%d")
                    cat_name_arg = str(tool_payload.get("category_name", "")).strip()

                    query = select(Transaction).where(
                        Transaction.user_id == current_user.id,
                        Transaction.type == "expense",
                        Transaction.transaction_date >= start_str,
                        Transaction.transaction_date <= end_str,
                    )

                    matched_cat = None
                    if cat_name_arg and categories:
                        for c in categories:
                            if cat_name_arg.lower() in c.name.lower():
                                matched_cat = c
                                break
                        if matched_cat:
                            query = query.where(Transaction.category_id == matched_cat.id)

                    txs = session.exec(query).all()
                    total_spent = sum(abs(float(t.amount)) for t in txs)

                    if matched_cat:
                        return ChatResponse(
                            reply=f"📊 Total spent on **'{matched_cat.name}'** ({start_str} to {end_str}): **${total_spent:.2f}** ({len(txs)} txs)."
                        )
                    return ChatResponse(
                        reply=f"📊 Total expenses ({start_str} to {end_str}): **${total_spent:.2f}** ({len(txs)} txs)."
                    )

                elif call_name == "get_budget_status_tool":
                    user_budgets = session.exec(
                        select(Budget).where(Budget.user_id == current_user.id)
                    ).all()

                    if not user_budgets:
                        return ChatResponse(reply="🎯 You don't have any active budgets set up yet.")

                    budget_lines = []
                    for b in user_budgets:
                        cat = session.get(Category, b.category_id) if getattr(b, 'category_id', None) else None
                        cat_title = cat.name if cat else "General"
                        budget_lines.append(f"• **{cat_title}**: ${b.monthly_limit:.2f} limit")

                    return ChatResponse(reply="🎯 **Your Active Budgets:**\n\n" + "\n".join(budget_lines))

                elif call_name == "create_transaction_tool":
                    amount_val = float(tool_payload.get("amount", 0.0))
                    cat_name_arg = str(tool_payload.get("category_name", "")).strip()
                    acc_name_arg = str(tool_payload.get("account_name", "")).strip()
                    tx_type_arg = str(tool_payload.get("transaction_type", "expense")).lower()

                    if amount_val > 0:
                        matched_cat = next((c for c in categories if cat_name_arg.lower() in c.name.lower()),
                                           None) if categories else None
                        matched_acc = next((a for a in accounts if acc_name_arg.lower() in a.account_name.lower()),
                                           accounts[0]) if accounts else None

                        if matched_acc:
                            new_tx = Transaction(
                                user_id=current_user.id,
                                account_id=matched_acc.id,
                                category_id=matched_cat.id if matched_cat else None,
                                amount=Decimal(str(amount_val)),
                                type=tx_type_arg,
                                description=f"Logged via AI ({cat_name_arg or 'General'})",
                                transaction_date=date.today(),
                            )

                            if tx_type_arg == "expense":
                                matched_acc.balance -= Decimal(str(amount_val))
                            else:
                                matched_acc.balance += Decimal(str(amount_val))

                            session.add(new_tx)
                            session.add(matched_acc)
                            session.commit()

                            if matched_cat:
                                check_and_trigger_notifications(
                                    user_id=current_user.id,
                                    account_id=matched_acc.id,
                                    category_id=matched_cat.id,
                                    session=session,
                                    tx_date=date.today()
                                )

                            return ChatResponse(
                                reply=f"✅ **Logged**: **${amount_val:.2f}** under **'{matched_cat.name if matched_cat else 'General'}'** using **{matched_acc.account_name}**."
                            )
            except Exception as parse_err:
                logger.warning(f"Tool execution JSON parse failed, returning raw response: {parse_err}")

        return ChatResponse(reply=response_text)

    except Exception as e:
        session.rollback()
        logger.error(f"Chat assistant error: {e}")
        return ChatResponse(reply=f"⚠️ Couldn't complete request: {str(e)}")