import os
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import SQLAlchemyError
from pydantic import ValidationError
from dotenv import load_dotenv
from sqlmodel import Session, select
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    ApplicationBuilder, ContextTypes, MessageHandler,
    CommandHandler, CallbackQueryHandler, filters
)
from database import engine, create_db_and_tables
from models import User, Account
from service.init_db import init_superadmin_and_defaults
from routes.telegram_service import process_incoming_telegram_message, handle_telegram_callback
from routes.ai_engine import extract_text_from_image_bytes
from database import get_session
import resend

from routes import (
    transactions_router,
    accounts_router,
    categories_router,
    budget_router,
    analytics_router,
    overview_router,
    calender_router,
    auth_router,
    notification_router,
    import_export_router,
    setting_router,
    pending_router,
    ai_engine_router,
    admin_router
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pftrack")

load_dotenv()
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")


async def handle_start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    tg_user_id = update.effective_user.id
    args = context.args

    if not args:
        await update.message.reply_text(
            "👋 Welcome to PFTrack Bot!\n\n"
            "To connect your account, please click the **'Connect Telegram Bot'** "
            "button in your PFTrack Web App Settings."
        )
        return

    linking_token = args[0]

    with Session(engine) as session:
        old_users = session.exec(
            select(User).where(User.telegram_id == tg_user_id)
        ).all()
        for old_user in old_users:
            old_user.telegram_id = None
            session.add(old_user)

        db_user = session.exec(
            select(User).where(User.telegram_linking_token == linking_token)
        ).first()

        if db_user:
            db_user.telegram_id = tg_user_id
            db_user.telegram_linking_token = None
            session.add(db_user)
            session.commit()

            await update.message.reply_text(
                f"✅ **Account Connected Successfully!**\n\n"
                f"Your Telegram is now linked to: {db_user.email}\n"
                f"You can now forward or upload KHQR receipt screenshots directly to this chat."
            )
        else:
            session.rollback()
            await update.message.reply_text(
                "❌ Link token is invalid or has already been used. "
                "Please generate a new link from your Web App Settings."
            )


async def handle_telegram_receipt(update: Update, context: ContextTypes.DEFAULT_TYPE):
    raw_text = ""
    image_bytes = None
    tg_user_id = update.effective_user.id

    # 1. Extract Text message OR Photo Caption
    if update.message:
        if update.message.text:
            raw_text = update.message.text
        elif update.message.caption:
            raw_text = update.message.caption

    # 2. Extract Photo Bytes if user uploaded an image
    if update.message and update.message.photo:
        processing_msg = await update.message.reply_text("⏳ Processing image receipt with AI...")
        try:
            photo_file = await update.message.photo[-1].get_file()
            image_bytes = bytes(await photo_file.download_as_bytearray())
        except Exception as e:
            logger.error(f"Error downloading photo from Telegram: {e}")
        finally:
            await processing_msg.delete()

    if raw_text or image_bytes:
        with Session(engine) as session:
            db_user = session.exec(
                select(User).where(User.telegram_id == tg_user_id)
            ).first()

            if not db_user:
                await update.message.reply_text(
                    "⚠️ Your Telegram account is not linked to any active user profile. "
                    "Please generate a new link from your Web App Settings."
                )
                return

            actual_user_id = db_user.id

        res = process_incoming_telegram_message(
            raw_text=raw_text,
            user_id=actual_user_id,
            image_bytes=image_bytes
        )

        # 🟢 Render Inline Keyboard Buttons when account selection is ambiguous
        if isinstance(res, dict) and res.get("status") == "needs_account_selection":
            amount = res["amount"]
            symbol = res["symbol"]
            merchant = res["merchant"]
            currency = res["currency"]
            accounts = res["accounts"]

            keyboard = []
            for acc in accounts:
                acc_symbol = "៛" if acc['currency'] == "KHR" else "$"
                btn_text = f"🏦 {acc['name']} ({acc['currency']}) — {acc_symbol}{acc['balance']:,.2f}"

                base_payload = f"sel_acc:{acc['id']}:{amount}:{currency}:"
                remaining_bytes = 64 - len(base_payload.encode('utf-8'))
                safe_merchant_bytes = merchant.encode('utf-8')[:remaining_bytes]
                safe_merchant = safe_merchant_bytes.decode('utf-8', 'ignore')

                callback_data = f"{base_payload}{safe_merchant}"
                keyboard.append([InlineKeyboardButton(btn_text, callback_data=callback_data)])

            reply_markup = InlineKeyboardMarkup(keyboard)

            await update.message.reply_text(
                f"🧾 *Receipt Scanned!*\n\n"
                f"• *Merchant:* `{merchant}`\n"
                f"• *Amount:* `{symbol}{amount:.2f} {currency}`\n\n"
                f"❓ *Please select the account to log this under:*",
                parse_mode="Markdown",
                reply_markup=reply_markup
            )
        else:
            msg_text = res.get("message", "Processing completed.") if isinstance(res, dict) else str(res)
            await update.message.reply_text(msg_text)
    else:
        await update.message.reply_text("⚠️ Could not read message or receipt image. Please try again.")


# 🟢 Handler for inline button taps
async def handle_telegram_callback_query(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    tg_user_id = update.effective_user.id
    with Session(engine) as session:
        db_user = session.exec(
            select(User).where(User.telegram_id == tg_user_id)
        ).first()

        if not db_user:
            await query.edit_message_text("⚠️ User account link not found.")
            return

        actual_user_id = db_user.id

    res = handle_telegram_callback(
        user_id=actual_user_id,
        callback_data=query.data
    )

    msg = res.get("message", "Processed successfully!")
    await query.edit_message_text(msg, parse_mode="Markdown")


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    init_superadmin_and_defaults()

    global tg_app
    if BOT_TOKEN:
        tg_app = ApplicationBuilder().token(BOT_TOKEN).build()
        tg_app.add_handler(CommandHandler("start", handle_start_command))
        tg_app.add_handler(MessageHandler((filters.TEXT | filters.PHOTO) & (~filters.COMMAND), handle_telegram_receipt))
        # 🟢 Register callback handler for inline keyboard button presses
        tg_app.add_handler(CallbackQueryHandler(handle_telegram_callback_query))

        await tg_app.initialize()
        await tg_app.start()
        logger.info("🤖 Telegram Bot initialized and ready for webhooks!")
    else:
        logger.warning("⚠️ Warning: TELEGRAM_BOT_TOKEN not found in environment variables.")

    yield

    if tg_app:
        logger.info("Shutting down Telegram Bot...")
        await tg_app.stop()
        await tg_app.shutdown()

app = FastAPI(lifespan=lifespan, title="Personal Finance Tracker API")

tg_app = None


@app.post("/telegram/webhook")
async def telegram_webhook(request: Request):
    if not tg_app:
        return {"status": "bot not initialized"}

    data = await request.json()
    update = Update.de_json(data, tg_app.bot)
    await tg_app.process_update(update)
    return {"status": "ok"}

@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    logger.error(f"🔴 [Database Exception] Path: {request.url.path} | Error: {str(exc)}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error_code": "DATABASE_ERROR",
            "message": "A database operation error occurred while processing your request.",
            "path": request.url.path
        }
    )

@app.exception_handler(ValidationError)
async def pydantic_validation_exception_handler(request: Request, exc: ValidationError):
    logger.warning(f"🟡 [Validation Exception] Path: {request.url.path} | Details: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error_code": "VALIDATION_ERROR",
            "details": exc.errors()
        }
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

app.include_router(transactions_router)
app.include_router(accounts_router)
app.include_router(categories_router)
app.include_router(budget_router)
app.include_router(overview_router)
app.include_router(analytics_router)
app.include_router(auth_router)
app.include_router(notification_router)
app.include_router(import_export_router)
app.include_router(setting_router)
app.include_router(pending_router)
app.include_router(ai_engine_router)
app.include_router(admin_router)
app.include_router(calender_router, prefix="/analytics")


@app.get("/")
def read_root():
    return {"message": "Welcome to your Finance API. System running smoothly."}