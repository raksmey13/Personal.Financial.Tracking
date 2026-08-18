import os
import certifi

# 🟢 FIX LOCAL MAC SSL CERTIFICATE BUNDLE PATH
os.environ["SSL_CERT_FILE"] = certifi.where()

import random
import shutil
import bcrypt
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, BackgroundTasks
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr
from sqlmodel import Session, select
from jose import JWTError, jwt

# 🟢 FASTAPI-MAIL IMPORTS
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType

from database import SessionDep
from models import User, UserProfile, Category

# 🟢 SMTP / EMAIL SERVICE CONFIGURATION
conf = ConnectionConfig(
    MAIL_USERNAME="nim.chanraksmey@gmail.com",
    MAIL_PASSWORD="pmpa vdml vznl ntis",
    MAIL_FROM="nim.chanraksmey@gmail.com",
    MAIL_PORT=587,
    MAIL_SERVER="smtp.gmail.com",
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=False
)

# 🟢 SECURITY CONFIGURATION
SECRET_KEY = "YOUR_SUPER_SECRET_KEY_CHANGE_THIS_IN_PRODUCTION"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 Days Token Validity

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="users/login", auto_error=False)

router = APIRouter(prefix="/users", tags=["Profile Management & Authentication"])

UPLOAD_DIR = "static/avatars"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ---------------------------------------------------------
# SECURITY & HELPER FUNCTIONS
# ---------------------------------------------------------
def hash_password(password: str) -> str:
    """Hashes a raw password using native bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a raw password against its stored bcrypt hash."""
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def provision_user_default_categories(session: Session, user_id: int):
    """
    Seeds essential baseline categories bound specifically to a newly registered user
    so downstream routes (like /accounts/) never fail due to missing foreign keys.
    """
    default_cats = [
        {"name": "Opening Balance", "type": "income", "icon": "wallet"},
        {"name": "Credit Card Payment", "type": "transfer", "icon": "credit-card"},
        {"name": "Loan Repayment", "type": "transfer", "icon": "bank"},
        {"name": "Loan Principal Top-Up", "type": "expense", "icon": "trending-up"},
        {"name": "Sweep Saving", "type": "income", "icon": "piggy-bank"},
        {"name": "General Expense", "type": "expense", "icon": "receipt"},
        {"name": "Food & Dining", "type": "expense", "icon": "utensils"},
        {"name": "Salary", "type": "income", "icon": "briefcase"},
        # 🟢 Added the missing 4 categories for all new users!
        {"name": "Transport", "type": "expense", "icon": "car"},
        {"name": "Shopping", "type": "expense", "icon": "shopping-bag"},
        {"name": "Entertainment", "type": "expense", "icon": "film"},
        {"name": "Bills & Utilities", "type": "expense", "icon": "bolt"},
    ]

    for cat in default_cats:
        existing = session.exec(
            select(Category).where(
                Category.name == cat["name"],
                Category.user_id == user_id
            )
        ).first()

        if not existing:
            new_cat = Category(
                name=cat["name"],
                type=cat["type"],
                icon=cat["icon"],
                user_id=user_id  # Strictly bound to new user
            )
            session.add(new_cat)

    session.flush()


async def send_otp_email(email_to: str, otp_code: str):
    """Dispatches the 6-digit OTP code to the user via SMTP."""
    try:
        message = MessageSchema(
            subject="PFTrack Account Verification Code",
            recipients=[email_to],
            body=f"Your 6-digit OTP verification code is: {otp_code}\n\nThis code is required to activate your PFTrack account.",
            subtype=MessageType.plain
        )
        fm = FastMail(conf)
        await fm.send_message(message)
        print(f"📧 REAL EMAIL DISPATCHED to {email_to}")
    except Exception as e:
        print(f"❌ SMTP FAILED: {str(e)}")
        raise e  # Force FastAPI to log the real Google error!


def create_access_token(data: dict) -> str:
    """Generates a signed JWT access token containing encoded payload metadata."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(session: SessionDep, token: Optional[str] = Depends(oauth2_scheme)) -> User:
    """
    DYNAMIC AUTH GENERATOR: Validates incoming Bearer JWT tokens and resolves
    the exact user object bound to the encoded token subject.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate authentication credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not token:
        raise credentials_exception

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        user_id = int(user_id_str)
    except (JWTError, ValueError):
        raise credentials_exception

    user = session.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive or no longer exists."
        )

    return user


# ---------------------------------------------------------
# DATA VALIDATION SCHEMAS
# ---------------------------------------------------------
class SignupRequest(BaseModel):
    first_name: str
    last_name: Optional[str] = ""
    email: EmailStr
    password: str


class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp_code: str


class LoginRequest(BaseModel):
    identifier: str
    password: str


class UserProfileUpdate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr


class UserPasswordUpdate(BaseModel):
    current_password: str
    new_password: str


# ---------------------------------------------------------
# AUTHENTICATION ENDPOINTS
# ---------------------------------------------------------

# 🚀 1. ACCOUNT REGISTRATION WITH 6-DIGIT OTP GENERATION & EMAIL DISPATCH
@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(signup_data: SignupRequest, session: SessionDep):
    existing_email = session.exec(select(User).where(User.email == signup_data.email)).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email is already registered.")

    hashed_pw = hash_password(signup_data.password)
    otp_code = str(random.randint(100000, 999999))

    new_user = User(
        email=signup_data.email,
        hashed_password=hashed_pw,
        is_verified=False,
        verification_token=otp_code
    )
    session.add(new_user)
    session.flush()

    new_profile = UserProfile(
        first_name=signup_data.first_name,
        last_name=signup_data.last_name or "",
        user_id=new_user.id
    )
    session.add(new_profile)

    provision_user_default_categories(session, new_user.id)
    session.commit()

    # Await email directly so FastAPI doesn't kill the connection early
    await send_otp_email(signup_data.email, otp_code)

    return {
        "message": "Account created. Verification required before logging in."
    }


# 🚀 2. VERIFY 6-DIGIT OTP CODE
@router.post("/verify-otp")
def verify_otp(verify_data: VerifyOTPRequest, session: SessionDep):
    user = session.exec(select(User).where(User.email == verify_data.email)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found."
        )

    if user.is_verified:
        return {"message": "Account is already verified. You may proceed to login."}

    if user.verification_token != verify_data.otp_code.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP code. Verification failed."
        )

    user.is_verified = True
    user.verification_token = None
    session.add(user)
    session.commit()

    return {"message": "Account verified successfully! You may now log in."}


# 🚀 3. DUAL-IDENTIFIER JWT LOGIN WITH VERIFICATION GUARD
@router.post("/login")
def login(login_data: LoginRequest, session: SessionDep):
    user = None

    if "@" in login_data.identifier:
        user = session.exec(select(User).where(User.email == login_data.identifier)).first()
    else:
        profiles = session.exec(
            select(UserProfile).where(UserProfile.first_name == login_data.identifier)
        ).all()

        for prof in profiles:
            if prof.user and verify_password(login_data.password, prof.user.hashed_password):
                user = prof.user
                break

    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid entry credentials. Please check your spelling or security keys."
        )

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not verified. Please verify your OTP code before logging in."
        )

    token = create_access_token(data={"sub": str(user.id)})

    return {
        "message": "Authentication token generated successfully.",
        "access_token": token,
        "token_type": "bearer"
    }


# 🚀 4. FETCH CURRENT PROFILE
# 🚀 4. FETCH CURRENT PROFILE
@router.get("/me")
def get_profile(session: SessionDep, current_user: User = Depends(get_current_user)):
    profile = current_user.profile

    avatar_url = getattr(profile, "avatar_url", None) if profile else None
    if not avatar_url:
        first_n = profile.first_name if profile and profile.first_name else "PF"
        last_n = profile.last_name if profile and profile.last_name else ""
        avatar_url = f"https://ui-avatars.com/api/?name={first_n}+{last_n}&background=random&size=128"

    return {
        "id": current_user.id,
        "email": current_user.email,
        "first_name": profile.first_name if profile else "",
        "last_name": profile.last_name if profile else "",
        "is_admin": current_user.is_admin,
        "avatar_url": avatar_url
    }


# 🚀 5. UPDATE GENERAL PROFILE DETAILS
@router.put("/me")
def update_profile(
        profile_data: UserProfileUpdate,
        session: SessionDep,
        current_user: User = Depends(get_current_user)
):
    if profile_data.email != current_user.email:
        email_check = session.exec(select(User).where(User.email == profile_data.email)).first()
        if email_check:
            raise HTTPException(status_code=400, detail="This email is already linked to another profile.")
        current_user.email = profile_data.email
        session.add(current_user)

    profile = current_user.profile
    if not profile:
        profile = UserProfile(
            first_name=profile_data.first_name,
            last_name=profile_data.last_name,
            user_id=current_user.id
        )
    else:
        profile.first_name = profile_data.first_name
        profile.last_name = profile_data.last_name

    session.add(profile)
    session.commit()

    token = create_access_token(data={"sub": str(current_user.id)})

    return {
        "message": "Profile details updated successfully",
        "access_token": token
    }


# 🚀 6. MULTIPART BINARY AVATAR UPLOAD
@router.post("/me/avatar")
def upload_avatar(
        session: SessionDep,
        file: UploadFile = File(...),
        current_user: User = Depends(get_current_user)
):
    profile = current_user.profile
    if not profile:
        raise HTTPException(status_code=404, detail="User profile record not found.")

    file_extension = os.path.splitext(file.filename)[1]
    custom_filename = f"user_{current_user.id}{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, custom_filename)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        profile.avatar_url = f"http://127.0.0.1:8000/{file_path}"
        session.add(profile)
        session.commit()

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to commit binary file stream: {str(e)}")

    return {
        "message": "Avatar uploaded and saved to database successfully.",
        "avatar_url": profile.avatar_url
    }


# 🚀 7. SECURITY GATEWAY PASSWORD CHANGE
@router.put("/me/change-password")
def change_password(
        password_data: UserPasswordUpdate,
        session: SessionDep,
        current_user: User = Depends(get_current_user)
):
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current security password parameter verification mismatch."
        )

    current_user.hashed_password = hash_password(password_data.new_password)
    session.add(current_user)
    session.commit()

    return {"message": "Access keys rotated and committed successfully."}