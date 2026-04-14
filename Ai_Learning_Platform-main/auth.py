from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from passlib.context import CryptContext
from jose import jwt, JWTError
from pydantic import BaseModel
from psycopg2.extras import RealDictCursor

from database import get_all_users, get_db_conn

# ================= CONFIG =================
SECRET_KEY = "CHANGE_THIS_IN_PRODUCTION"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

router = APIRouter(prefix="/auth", tags=["auth"])

bcrypt_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_bearer = OAuth2PasswordBearer(tokenUrl="auth/token")

# ================= SCHEMAS =================
class CreateUserRequest(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


# ================= HELPERS =================
def hash_password(password: str):
    # bcrypt max 72 bytes
    return bcrypt_context.hash(password[:72])


def verify_password(plain_password: str, hashed_password: str):
    return bcrypt_context.verify(plain_password[:72], hashed_password)


def create_access_token(user_id: int, username: str):
    payload = {
        "sub": username,
        "id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_user_by_username(conn, username: str):
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT * FROM users WHERE username = %s", (username,))
        return cur.fetchone()
    finally:
        cur.close()


def create_user(conn, username: str, password: str):
    cur = conn.cursor()
    try:
        existing_user = get_user_by_username(conn, username)
        if existing_user:
            raise HTTPException(status_code=400, detail="Username already taken")

        hashed_password = hash_password(password)

        cur.execute(
            "INSERT INTO users (username, hashed_password, created_at) VALUES (%s, %s, %s)",
            (username, hashed_password, datetime.utcnow().isoformat())
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


def authenticate_user(conn, username: str, password: str):
    user = get_user_by_username(conn, username)

    if not user:
        return None

    if not verify_password(password, user["hashed_password"]):
        return None

    return user


# ================= ROUTES =================

# 🔹 REGISTER
@router.post("/register")
def register(user: CreateUserRequest):
    conn = get_db_conn()
    try:
        create_user(conn, user.username, user.password)
        return {"message": "User created successfully"}
    finally:
        conn.close()


# 🔹 LOGIN
@router.post("/token", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    conn = get_db_conn()
    try:
        user = authenticate_user(conn, form_data.username, form_data.password)

        if not user:
            raise HTTPException(status_code=401, detail="Invalid username or password")

        token = create_access_token(user["id"], user["username"])

        return {
            "access_token": token,
            "token_type": "bearer"
        }
    finally:
        conn.close()


# 🔹 GET CURRENT USER
def get_current_user(token: str = Depends(oauth2_bearer)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        username = payload.get("sub")
        user_id = payload.get("id")

        if username is None or user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")

        return {"username": username, "id": user_id}

    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


# 🔹 PROTECTED ROUTE
@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

# 🔹 GET ALL USERS (SAFE)
@router.get("/users")
def get_all_users_route():
    return get_all_users()