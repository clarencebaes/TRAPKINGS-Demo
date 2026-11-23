import logging
import os
import secrets
import smtplib
import ssl
from email.message import EmailMessage

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pymysql.err import IntegrityError

from .db import check_password, database, password_hash, token_hash
from .forms import Account, Credentials, PasswordChange, Registration, ResetPassword, ResetRequest, Shipping

router = APIRouter(prefix="/api")
COOKIE = "trapkings_session"
ACCOUNT_FIELDS = "id,username,email,role,full_name,address,phone,note"


def require_user(request: Request):
    token = request.cookies.get(COOKIE)
    if not token:
        raise HTTPException(401, "Please sign in first.")
    with database() as cursor:
        cursor.execute(
            f"SELECT {','.join('u.' + field for field in ACCOUNT_FIELDS.split(','))} "
            "FROM users u JOIN sessions s ON u.id=s.user_id "
            "WHERE s.token_hash=%s AND s.expires_at>UTC_TIMESTAMP() AND u.active=TRUE",
            (token_hash(token),),
        )
        account = cursor.fetchone()
    if account is None:
        raise HTTPException(401, "Your session has expired. Please sign in again.")
    return account


def require_admin(user=Depends(require_user)):
    if user["role"] != "admin":
        raise HTTPException(403, "Staff access required.")
    return user


def start_session(cursor, user_id, response):
    token = secrets.token_urlsafe(32)
    cursor.execute(
        "INSERT INTO sessions VALUES (%s,%s,UTC_TIMESTAMP() + INTERVAL 7 DAY)",
        (token_hash(token), user_id),
    )
    response.set_cookie(
        COOKIE, token, max_age=604800, httponly=True, samesite="strict",
        secure=os.getenv("TRAPKINGS_SECURE_COOKIE") == "1",
    )


@router.post("/register", status_code=201)
def register(form: Registration, response: Response):
    try:
        with database() as cursor:
            cursor.execute(
                "INSERT INTO users (username,email,password_hash) VALUES (%s,%s,%s)",
                (form.username, form.email, password_hash(form.password)),
            )
            user_id = cursor.lastrowid
            start_session(cursor, user_id, response)
            cursor.execute(f"SELECT {ACCOUNT_FIELDS} FROM users WHERE id=%s", (user_id,))
            return cursor.fetchone()
    except IntegrityError as error:
        raise HTTPException(409, "That email or username is already registered.") from error


@router.post("/login")
def login(form: Credentials, response: Response):
    identifier = form.email.strip()
    column = "email" if "@" in identifier else "username"
    with database() as cursor:
        cursor.execute(
            f"SELECT {ACCOUNT_FIELDS},password_hash FROM users WHERE {column}=%s AND active=TRUE",
            (identifier,),
        )
        user = cursor.fetchone()
        if not user or not check_password(form.password, user.pop("password_hash")):
            raise HTTPException(401, "Sign-in details are incorrect.")
        start_session(cursor, user["id"], response)
        return user


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response):
    token = request.cookies.get(COOKIE)
    if token:
        with database() as cursor:
            cursor.execute("DELETE FROM sessions WHERE token_hash=%s", (token_hash(token),))
    response.delete_cookie(COOKIE)


@router.get("/me")
def account(user=Depends(require_user)):
    return user


@router.put("/me")
def edit_account(form: Account, user=Depends(require_user)):
    try:
        with database() as cursor:
            cursor.execute("UPDATE users SET username=%s,email=%s WHERE id=%s", (form.username, form.email, user["id"]))
    except IntegrityError as error:
        raise HTTPException(409, "That email or username is already registered.") from error
    return {**user, **form.model_dump()}


@router.put("/me/shipping")
def edit_shipping(form: Shipping, user=Depends(require_user)):
    with database() as cursor:
        cursor.execute(
            "UPDATE users SET full_name=%s,address=%s,phone=%s,note=%s WHERE id=%s",
            (form.full_name, form.address, form.phone, form.note, user["id"]),
        )
    return {**user, **form.model_dump()}


@router.put("/me/password", status_code=204)
def change_password(form: PasswordChange, request: Request, user=Depends(require_user)):
    with database() as cursor:
        cursor.execute("SELECT password_hash FROM users WHERE id=%s FOR UPDATE", (user["id"],))
        if not check_password(form.current, cursor.fetchone()["password_hash"]):
            raise HTTPException(400, "Current password is incorrect.")
        cursor.execute("UPDATE users SET password_hash=%s WHERE id=%s", (password_hash(form.password), user["id"]))
        cursor.execute(
            "DELETE FROM sessions WHERE user_id=%s AND token_hash<>%s",
            (user["id"], token_hash(request.cookies[COOKIE])),
        )
        cursor.execute("DELETE FROM password_resets WHERE user_id=%s", (user["id"],))


@router.post("/password/forgot", status_code=204)
def forgot_password(form: ResetRequest):
    host = os.getenv("TRAPKINGS_SMTP_HOST")
    origin = os.getenv("TRAPKINGS_PUBLIC_ORIGIN")
    sender = os.getenv("TRAPKINGS_SMTP_FROM")
    if not all((host, origin, sender)):
        raise HTTPException(503, "Password reset email is unavailable. Please contact the store.")
    token = secrets.token_urlsafe(32)
    with database() as cursor:
        cursor.execute("SELECT id,email FROM users WHERE email=%s AND active=TRUE", (form.email.lower(),))
        user = cursor.fetchone()
        if not user:
            return
        cursor.execute(
            "INSERT INTO password_resets VALUES (%s,%s,UTC_TIMESTAMP() + INTERVAL 30 MINUTE)",
            (token_hash(token), user["id"]),
        )
    message = EmailMessage()
    message["From"] = sender
    message["To"] = user["email"]
    message["Subject"] = "TRAPKINGS password reset"
    message.set_content(f"Reset your password within 30 minutes: {origin.rstrip('/')}/reset-password#token={token}")
    try:
        with smtplib.SMTP(host, int(os.getenv("TRAPKINGS_SMTP_PORT", "587")), timeout=8) as smtp:
            smtp.starttls(context=ssl.create_default_context())
            if os.getenv("TRAPKINGS_SMTP_USER"):
                smtp.login(os.environ["TRAPKINGS_SMTP_USER"], os.environ["TRAPKINGS_SMTP_PASSWORD"])
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException):
        logging.getLogger(__name__).warning("Password reset email delivery failed")


@router.post("/password/reset", status_code=204)
def reset_password(form: ResetPassword):
    with database() as cursor:
        cursor.execute(
            "SELECT user_id FROM password_resets WHERE token_hash=%s AND expires_at>UTC_TIMESTAMP() FOR UPDATE",
            (token_hash(form.token),),
        )
        record = cursor.fetchone()
        if not record:
            raise HTTPException(400, "This password reset link is invalid or expired.")
        user_id = record["user_id"]
        cursor.execute("UPDATE users SET password_hash=%s WHERE id=%s", (password_hash(form.password), user_id))
        cursor.execute("DELETE FROM password_resets WHERE user_id=%s", (user_id,))
        cursor.execute("DELETE FROM sessions WHERE user_id=%s", (user_id,))
