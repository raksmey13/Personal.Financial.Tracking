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
from telegram import Update
from telegram.ext import ApplicationBuilder, ContextTypes, MessageHandler, CommandHandler, filters
from database import engine, create_db_and_tables
from models import User, Account
from service.init_db import init_superadmin_and_defaults
from routes.telegram_service import process_incoming_telegram_message
from routes.ai_engine import extract_text_from_image_bytes
from database import get_session  # or relative: from ..database import get_session
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

    # 2. Extract Photo Bytes if user uploaded a image
    if update.message and update.message.photo:
        processing_msg = await update.message.reply_text("⏳ Processing image receipt with AI...")
        try:
            photo_file = await update.message.photo[-1].get_file()
            # Convert bytearray to bytes
            image_bytes = bytes(await photo_file.download_as_bytearray())
        except Exception as e:
            logger.error(f"Error downloading photo from Telegram: {e}")
        finally:
            await processing_msg.delete()

    # Must have either text or image_bytes to proceed
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

        # 🟢 Pass BOTH raw_text AND image_bytes to process_incoming_telegram_message
        reply_msg = process_incoming_telegram_message(
            raw_text=raw_text,
            user_id=actual_user_id,
            image_bytes=image_bytes
        )
        await update.message.reply_text(reply_msg)
    else:
        await update.message.reply_text("⚠️ Could not read message or receipt image. Please try again.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    init_superadmin_and_defaults()

    tg_app = None
    if BOT_TOKEN:
        tg_app = ApplicationBuilder().token(BOT_TOKEN).build()
        tg_app.add_handler(CommandHandler("start", handle_start_command))
        tg_app.add_handler(MessageHandler((filters.TEXT | filters.PHOTO) & (~filters.COMMAND), handle_telegram_receipt))

        await tg_app.initialize()
        await tg_app.start()
        asyncio.create_task(tg_app.updater.start_polling())
        logger.info("🤖 Telegram Bot listener initialized and running in background!")
    else:
        logger.warning("⚠️ Warning: TELEGRAM_BOT_TOKEN not found in environment variables.")

    yield

    if tg_app:
        logger.info("Stopping Telegram Bot...")
        await tg_app.updater.stop()
        await tg_app.stop()
        await tg_app.shutdown()


app = FastAPI(lifespan=lifespan, title="Personal Finance Tracker API")

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