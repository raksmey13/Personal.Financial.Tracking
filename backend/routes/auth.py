import os
import certifi

# 🟢 FIX LOCAL MAC SSL CERTIFICATE BUNDLE PATH
os.environ["SSL_CERT_FILE"] = certifi.where()

import random
import shutil
import bcrypt
import resend
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr
from sqlmodel import Session, select
from jose import JWTError, jwt

from database import SessionDep
from models import User, UserProfile, Category

# 🟢 RESEND API CONFIGURATION
resend.api_key = os.getenv("RESEND_API_KEY")

# 🟢 SECURITY CONFIGURATION
SECRET_KEY = os.getenv("SECRET_KEY", "YOUR_SUPER_SECRET_KEY_CHANGE_THIS_IN_PRODUCTION")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 Days Token Validity

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="users/login", auto_error=False)

router = APIRouter(prefix="/users", tags=["Profile Management & Authentication"])

UPLOAD_DIR = "static/avatars"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ---------------------------------------------------------
# TEMPORARY IN-MEMORY STORAGE FOR UNVERIFIED SIGNUPS & RESETS
# Data stays here and is ONLY written to the DB after OTP verify
# ---------------------------------------------------------
pending_registrations: Dict[str, Any] = {}
password_resets: Dict[str, Any] = {}


# ---------------------------------------------------------
# SECURITY & HELPER FUNCTIONS
# ---------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def provision_user_default_categories(session: Session, user_id: int):
    default_cats = [
        {"name": "Opening Balance", "type": "income", "icon": "wallet"},
        {"name": "Credit Card Payment", "type": "transfer", "icon": "credit-card"},
        {"name": "Loan Repayment", "type": "transfer", "icon": "bank"},
        {"name": "Loan Principal Top-Up", "type": "expense", "icon": "trending-up"},
        {"name": "Sweep Saving", "type": "income", "icon": "piggy-bank"},
        {"name": "General Expense", "type": "expense", "icon": "receipt"},
        {"name": "Food & Dining", "type": "expense", "icon": "utensils"},
        {"name": "Salary", "type": "income", "icon": "briefcase"},
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
                user_id=user_id
            )
            session.add(new_cat)

    session.flush()


async def send_otp_email(email_to: str, otp_code: str):
    try:
        params: resend.Emails.SendParams = {
            "from": "PFTrack <no-reply@pftrack.site>",
            "to": [email_to],
            "subject": "PFTrack Account Verification Code",
            "html": f"""
                <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0; rounded: 8px;">
                    <h2 style="color: #1e293b; text-align: center;">Welcome to PFTrack!</h2>
                    <p style="color: #475569; text-align: center;">Your 6-digit OTP verification code is:</p>
                    <div style="background-color: #f1f5f9; padding: 15px; border-radius: 6px; text-align: center; margin: 20px 0;">
                        <h1 style="color: #3D5AFE; letter-spacing: 4px; font-size: 32px; margin: 0;">{otp_code}</h1>
                    </div>
                    <p style="color: #64748b; font-size: 14px; text-align: center;">This code is required to activate your account. Do not share it with anyone.</p>
                </div>
            """,
        }
        response = resend.Emails.send(params)
        print(f"📧 EMAIL DISPATCHED VIA RESEND to {email_to}: {response}")
        return response
    except Exception as e:
        print(f"❌ RESEND DISPATCH FAILED: {str(e)}")
        raise e


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(session: SessionDep, token: Optional[str] = Depends(oauth2_scheme)) -> User:
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


class ResendOTPRequest(BaseModel):
    email: EmailStr


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


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp_code: str
    new_password: str


# ---------------------------------------------------------
# AUTHENTICATION ENDPOINTS
# ---------------------------------------------------------

# 🚀 1. ACCOUNT REGISTRATION (TEMPORARY MEMORY STORAGE)
@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(signup_data: SignupRequest, session: SessionDep):
    # Ensure they aren't already fully registered in the actual database
    existing_email = session.exec(select(User).where(User.email == signup_data.email)).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email is already registered.")

    hashed_pw = hash_password(signup_data.password)
    otp_code = str(random.randint(100000, 999999))

    # Save to server memory INSTEAD of Database
    pending_registrations[signup_data.email] = {
        "first_name": signup_data.first_name,
        "last_name": signup_data.last_name,
        "email": signup_data.email,
        "hashed_password": hashed_pw,
        "otp_code": otp_code,
        "expires_at": datetime.utcnow() + timedelta(minutes=15)
    }

    # Dispatch email
    await send_otp_email(signup_data.email, otp_code)

    return {
        "message": "OTP sent to email. Account details saved temporarily pending verification."
    }


# 🚀 2. VERIFY OTP CODE (ACTUAL DATABASE INSERTION)
@router.post("/verify-otp")
def verify_otp(verify_data: VerifyOTPRequest, session: SessionDep):
    pending_user = pending_registrations.get(verify_data.email)

    if not pending_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pending registration not found. Please sign up again."
        )

    if datetime.utcnow() > pending_user["expires_at"]:
        del pending_registrations[verify_data.email]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has expired. Please sign up again or request a new OTP."
        )

    if pending_user["otp_code"] != verify_data.otp_code.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP code. Verification failed."
        )

    # ✅ OTP IS CORRECT: Now we finally insert everything into the database
    new_user = User(
        email=pending_user["email"],
        hashed_password=pending_user["hashed_password"],
        is_verified=True,
        verification_token=None
    )
    session.add(new_user)
    session.flush()

    new_profile = UserProfile(
        first_name=pending_user["first_name"],
        last_name=pending_user["last_name"] or "",
        user_id=new_user.id
    )
    session.add(new_profile)

    provision_user_default_categories(session, new_user.id)
    session.commit()

    # Clean up the memory storage for this user
    del pending_registrations[verify_data.email]

    return {"message": "Account created and verified successfully! You may now log in."}


# 🚀 3. RESEND OTP ENDPOINT
@router.post("/resend-otp")
async def resend_otp(resend_data: ResendOTPRequest, session: SessionDep):
    pending_user = pending_registrations.get(resend_data.email)

    if not pending_user:
        # Let's also check if they are already fully verified in the actual DB
        existing_user = session.exec(select(User).where(User.email == resend_data.email)).first()
        if existing_user and existing_user.is_verified:
            raise HTTPException(status_code=400, detail="Account is already registered and verified. Please log in.")

        raise HTTPException(status_code=404, detail="No pending registration found. Please sign up first.")

    # Generate new OTP and reset timer
    new_otp = str(random.randint(100000, 999999))
    pending_registrations[resend_data.email]["otp_code"] = new_otp
    pending_registrations[resend_data.email]["expires_at"] = datetime.utcnow() + timedelta(minutes=15)

    # Dispatch email
    await send_otp_email(resend_data.email, new_otp)

    return {"message": "A new OTP has been sent to your email."}


# 🚀 4. DUAL-IDENTIFIER JWT LOGIN
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


# 🚀 5. FETCH CURRENT PROFILE
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


# 🚀 6. UPDATE GENERAL PROFILE DETAILS
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


# 🚀 7. MULTIPART BINARY AVATAR UPLOAD
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

        profile.avatar_url = f"https://personal-financial-tracking.onrender.com/{file_path}"
        session.add(profile)
        session.commit()

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to commit binary file stream: {str(e)}")

    return {
        "message": "Avatar uploaded and saved to database successfully.",
        "avatar_url": profile.avatar_url
    }


# 🚀 8. SECURITY GATEWAY PASSWORD CHANGE
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


# 🚀 9. REQUEST PASSWORD RESET OTP
@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest, session: SessionDep):
    user = session.exec(select(User).where(User.email == request.email)).first()

    if user and user.is_verified:
        otp_code = str(random.randint(100000, 999999))
        password_resets[request.email] = {
            "otp_code": otp_code,
            "expires_at": datetime.utcnow() + timedelta(minutes=15)
        }

        try:
            params: resend.Emails.SendParams = {
                "from": "PFTrack <no-reply@pftrack.site>",
                "to": [request.email],
                "subject": "PFTrack Password Reset Code",
                "html": f"""
                    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <h2 style="color: #1e293b; text-align: center;">Reset Your Password</h2>
                        <p style="color: #475569; text-align: center;">Your 6-digit verification code to reset your password is:</p>
                        <div style="background-color: #f1f5f9; padding: 15px; border-radius: 6px; text-align: center; margin: 20px 0;">
                            <h1 style="color: #ef4444; letter-spacing: 4px; font-size: 32px; margin: 0;">{otp_code}</h1>
                        </div>
                        <p style="color: #64748b; font-size: 14px; text-align: center;">If you did not request this, please ignore this email.</p>
                    </div>
                """,
            }
            resend.Emails.send(params)
        except Exception as e:
            print(f"❌ RESEND DISPATCH FAILED: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to send reset email.")

    return {"message": "If the email is registered, a password reset code has been sent."}


# 🚀 10. VERIFY OTP AND SET NEW PASSWORD
@router.post("/reset-password")
def reset_password(request: ResetPasswordRequest, session: SessionDep):
    reset_data = password_resets.get(request.email)

    if not reset_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No password reset request found for this email."
        )

    if datetime.utcnow() > reset_data["expires_at"]:
        del password_resets[request.email]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset code has expired. Please request a new one."
        )

    if reset_data["otp_code"] != request.otp_code.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP verification code."
        )

    user = session.exec(select(User).where(User.email == request.email)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.hashed_password = hash_password(request.new_password)
    session.add(user)
    session.commit()

    del password_resets[request.email]

    return {"message": "Password reset successfully. You may now log in with your new password."}