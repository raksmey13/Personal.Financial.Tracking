import re
import logging
from typing import Optional
from sqlmodel import Session, select

from database import engine
from models import User
from .ai_engine import (
    process_transaction_input,
    extract_text_from_image_bytes,
    handle_ui_chat_assistant,
    ChatRequest
)

logger = logging.getLogger(__name__)


def is_question_or_query(text: str) -> bool:
    """
    Returns True if the message is asking for info/summaries rather than logging an expense.
    """
    if not text:
        return False

    text_clean = text.strip().lower()

    # 1. If it contains a clear price/spending entry phrase (e.g., "Spent $10", "Coffee $3"), treat as expense log
    if re.search(r'(?:spent|paid|\$)\s*\d+', text_clean) or re.search(r'\d+\s*(?:usd|\$|khr|៛)', text_clean):
        return False

    # 2. General conversational or financial question triggers
    query_keywords = [
        "what", "how", "show", "get", "list", "check", "history",
        "summary", "balance", "last", "recent", "budget", "spent", "total", "income", "my"
    ]

    return "?" in text_clean or any(kw in text_clean for kw in query_keywords)


def process_incoming_telegram_message(
        raw_text: str,
        user_id: int,
        image_bytes: Optional[bytes] = None
) -> str:
    """
    Unified router for Telegram incoming payloads:
    1. Image / Receipt Upload -> Processed via OCR & Gemini Vision
    2. Questions / Balance Queries -> Handled by AI Assistant (Function Calling)
    3. Natural Language Expense Logging -> Parsed & Saved to Ledger / Pending Inbox
    """
    # 1. Receipt Image Upload (Compressed photo or Raw Document Image)
    if image_bytes:
        logger.info(f"📸 Routing Telegram message to Vision OCR pipeline for User ID: {user_id}")
        return process_transaction_input(
            user_id=user_id,
            raw_text=raw_text,
            image_bytes=image_bytes,
            source="telegram"
        )

    # 2. General Questions & Financial Assistant Queries
    if raw_text and is_question_or_query(raw_text):
        logger.info(f"💬 Routing Telegram message to AI Chat Assistant for User ID: {user_id}")
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
            logger.error(f"Error executing Telegram AI Chat Assistant query: {e}")
            # Fall back to standard transaction parsing if chat assistant encounters an issue

    # 3. Standard Natural Language Expense Entry (e.g., "Spent $5.50 on Coffee")
    logger.info(f"📝 Routing Telegram message to Transaction Input Parser for User ID: {user_id}")
    return process_transaction_input(
        user_id=user_id,
        raw_text=raw_text,
        image_bytes=None,
        source="telegram"
    )