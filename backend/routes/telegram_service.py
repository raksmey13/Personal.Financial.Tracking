import re
from typing import Optional
from sqlmodel import Session, select
from database import engine
from models import User
from .ai_engine import (
    process_transaction_input,
    extract_text_from_image_bytes,  # 👈 Exporting here allows main.py to import it
    handle_ui_chat_assistant,
    ChatRequest
)

def is_question_or_query(text: str) -> bool:
    """Returns True if the message is asking for info rather than logging an expense."""
    if not text:
        return False

    text_clean = text.strip().lower()

    # If it contains a clear price/spending phrase (e.g. "Spent $10", "Coffee $3"), log it
    if re.search(r'(?:spent|paid|\$)\s*\d+', text_clean) or re.search(r'\d+\s*(?:usd|\$|khr)', text_clean):
        return False

    # Question triggers
    query_keywords = [
        "what", "how", "show", "get", "list", "check", "history",
        "summary", "balance", "last", "recent", "budget", "spent", "total", "income"
    ]

    return "?" in text_clean or any(kw in text_clean for kw in query_keywords)


def process_incoming_telegram_message(
        raw_text: str,
        user_id: int,
        image_bytes: Optional[bytes] = None
) -> str:
    """
    Unified router for Telegram:
    1. Image / Receipt -> Processed via OCR / Gemini Vision
    2. Questions -> Routed to AI Chat Assistant (with Function Calling)
    3. Expense Entries -> Saved to Transaction Ledger
    """
    # 1. Receipt Image Upload
    if image_bytes:
        return process_transaction_input(
            user_id=user_id,
            raw_text=raw_text,
            image_bytes=image_bytes,
            source="telegram"
        )

    # 2. General Questions & Queries
    if raw_text and is_question_or_query(raw_text):
        try:
            with Session(engine) as session:
                db_user = session.get(User, user_id)
                if db_user:
                    payload = ChatRequest(message=raw_text)
                    response = handle_ui_chat_assistant(
                        payload=payload,
                        session=session,
                        current_user=db_user
                    )
                    return response.reply
        except Exception as e:
            # Fall back to transaction parser if database lookup fails
            pass

    # 3. Standard Natural Language Transaction Logging
    return process_transaction_input(
        user_id=user_id,
        raw_text=raw_text,
        image_bytes=None,
        source="telegram"
    )