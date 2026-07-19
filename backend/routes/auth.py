import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session, select
from database import SessionDep
from models import User, UserProfile
from pydantic import BaseModel, EmailStr
from typing import Optional

# Initialize the router container for inclusion in main.py
router = APIRouter(prefix="/users", tags=["Profile Management & Authentication"])

# 🟢 SETUP OAuth2 extractor scheme to intercept incoming request authorization headers
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="users/login", auto_error=False)

# 🟢 CONFIGURATION: Local directory on your machine to save avatar images
UPLOAD_DIR = "static/avatars"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def get_current_user(session: SessionDep, token: Optional[str] = Depends(oauth2_scheme)) -> User:
    """
    DYNAMIC AUTH GENERATOR: Inspects the Bearer token string to query
    and identify precisely which authenticated account is requesting its data profile.
    """
    user = None

    # If no token is provided or it's an old default mock string, load the newest registered user
    if not token or token == "mock-jwt-token" or "mockTokenData" in token:
        user = session.exec(select(User).order_by(User.id.desc())).first()
    else:
        # 🟢 DYNAMIC LOOKUP: Decode identity parameters directly out of the custom bearer string token
        if "@" in token:
            user = session.exec(select(User).where(User.email == token)).first()
        else:
            profile = session.exec(select(UserProfile).where(UserProfile.first_name == token)).first()
            if profile:
                user = profile.user

    # Emergency fallback if database tables are completely empty
    if not user:
        user = session.get(User, 1)
        if not user:
            user = User(id=1, email="smey@example.com", hashed_password="mock_password_hash", is_active=True)
            session.add(user)
            session.commit()

            profile = UserProfile(first_name="Nim", last_name="Chanraksmey", user_id=user.id)
            session.add(profile)
            session.commit()

    return user


# 🚀 1. DATA VALIDATION SCHEMAS (Pydantic Input Models)
class SignupRequest(BaseModel):
    username: str  # This unique handle will be saved in the UserProfile table
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    identifier: str  # Can accept EITHER the email string OR the username string handle
    password: str


# 💡 FIXED: Added email to the schema validation layer so the frontend can submit it
class UserProfileUpdate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr


class UserPasswordUpdate(BaseModel):
    current_password: str
    new_password: str


# 🚀 2. ENDPOINT: ACCOUNT REGISTRATION (SIGNUP)
@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(signup_data: SignupRequest, session: SessionDep):
    existing_email = session.exec(select(User).where(User.email == signup_data.email)).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email is already registered.")

    existing_username = session.exec(select(UserProfile).where(UserProfile.first_name == signup_data.username)).first()
    if existing_username:
        raise HTTPException(status_code=400, detail="Username handle is already taken.")

    # Step 1: Save auth credentials to the User table
    new_user = User(
        email=signup_data.email,
        hashed_password=signup_data.password
    )
    session.add(new_user)
    session.flush()

    # Step 2: Route the username parameter into the UserProfile entity table structure
    new_profile = UserProfile(
        first_name=signup_data.username,
        last_name="",
        user_id=new_user.id
    )
    session.add(new_profile)
    session.commit()

    return {"message": "Master account credentials registered successfully."}


# 🚀 3. ENDPOINT: DUAL-IDENTIFIER USER VALIDATION (LOGIN)
@router.post("/login")
def login(login_data: LoginRequest, session: SessionDep):
    user = None

    if "@" in login_data.identifier:
        user = session.exec(select(User).where(User.email == login_data.identifier)).first()
    else:
        profile = session.exec(select(UserProfile).where(UserProfile.first_name == login_data.identifier)).first()
        if profile:
            user = profile.user

    if not user or user.hashed_password != login_data.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid entry credentials. Please check your spelling or security keys."
        )

    return {
        "message": "Authentication token generated successfully.",
        "access_token": login_data.identifier
    }


# 🚀 4. ENDPOINT: FETCH CURRENT USER PROFILE DETAILS
@router.get("/me")
def get_profile(session: SessionDep, current_user: User = Depends(get_current_user)):
    profile = current_user.profile

    avatar_url = getattr(profile, "avatar_url", None) if profile else None
    if not avatar_url:
        name_param = f"{profile.first_name if profile else 'PF'}+{profile.last_name if profile else ''}"
        avatar_url = f"https://ui-avatars.com/api/?name={name_param}&background=random&size=128"

    return {
        "email": current_user.email,
        "first_name": profile.first_name if profile else "",
        "last_name": profile.last_name if profile else "",
        "avatar_url": avatar_url
    }


# 🚀 5. ENDPOINT: UPDATE GENERAL PROFILE DETAILS (FIXED FOR EMAIL)
@router.put("/me")
def update_profile(
        profile_data: UserProfileUpdate,
        session: SessionDep,
        current_user: User = Depends(get_current_user)
):
    # 💡 FIX part A: Verify if the updated email isn't already taken by someone else
    if profile_data.email != current_user.email:
        email_check = session.exec(select(User).where(User.email == profile_data.email)).first()
        if email_check:
            raise HTTPException(status_code=400, detail="This email is already linked to another profile.")
        current_user.email = profile_data.email
        session.add(current_user)

    # Update Profile Table Data
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

    # 💡 IMPORTANT NOTE: Because your token system uses the email/username directly as the access string,
    # we return an updated token back to the frontend so your session stays active if email changes!
    return {
        "message": "Profile details updated successfully",
        "access_token": current_user.email
    }


# 🚀 6. NEW ENDPOINT: MULTIPART BINARY AVATAR UPLOAD ROUTE
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

        if hasattr(profile, "avatar_url"):
            profile.avatar_url = f"http://127.0.0.1:8000/{file_path}"
            session.add(profile)
            session.commit()

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to commit binary file stream: {str(e)}")

    return {
        "message": "Avatar uploaded and saved to database successfully.",
        "avatar_url": f"http://127.0.0.1:8000/{file_path}"
    }


# 🚀 7. ENDPOINT: SECURITY GATEWAY PASSWORD CHANGE (FIXED EXCEPTION STATUS CRASH)
@router.put("/me/change-password")
def change_password(
        password_data: UserPasswordUpdate,
        session: SessionDep,
        current_user: User = Depends(get_current_user)
):
    # 💡 FIX: Your previous validation raised status_code=True/False (a boolean value), which caused a crash.
    # We fix it here to raise a proper standard 400 Bad Request status code.
    if password_data.current_password != current_user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current security password parameter verification mismatch."
        )

    current_user.hashed_password = password_data.new_password
    session.add(current_user)
    session.commit()

    return {"message": "Access keys rotated and committed successfully."}