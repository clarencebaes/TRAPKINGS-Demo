import re
import secrets

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pymysql.err import IntegrityError

from .accounts import require_admin
from .db import ROOT, database, get_products, password_hash, save_product
from .forms import OrderAction, Product, ProductUpdate, StaffAccount
from .shop import cancel_order, order_list

router = APIRouter(prefix="/api")
media_dir = ROOT / ".runtime" / "uploads"


@router.get("/admin/dashboard")
def dashboard(_=Depends(require_admin)):
    with database() as cursor:
        cursor.execute(
            "SELECT COUNT(*) AS order_count, "
            "COALESCE(SUM(CASE WHEN status='received' THEN total ELSE 0 END),0) AS revenue FROM orders"
        )
        stats = cursor.fetchone()
        cursor.execute("SELECT COUNT(*) AS users FROM users WHERE active=TRUE")
        stats.update(cursor.fetchone())
        cursor.execute("SELECT id,username,email,role FROM users WHERE active=TRUE ORDER BY id DESC LIMIT 5")
        recent_users = cursor.fetchall()
        products = get_products(cursor, include_inactive=True)
        cursor.execute(
            "SELECT i.product_name,SUM(i.quantity) AS sold FROM order_items i JOIN orders o ON o.id=i.order_id "
            "WHERE o.status='received' GROUP BY i.product_name ORDER BY sold DESC,i.product_name LIMIT 5"
        )
        best = cursor.fetchall()
        stats["products"] = len(products)
        return {
            "stats": stats, "users": recent_users, "orders": order_list(cursor)[:5],
            "products": [product for product in products if product["active"]][:5], "best": best,
        }


@router.get("/admin/products")
def inventory(_=Depends(require_admin)):
    with database() as cursor:
        return get_products(cursor, include_inactive=True)


@router.post("/admin/products", status_code=201)
def new_product(form: Product, _=Depends(require_admin)):
    slug = (re.sub(r"[^a-z0-9]+", "-", form.name.lower()).strip("-") or "product")[:72]
    with database() as cursor:
        product_id = save_product(cursor, {**form.model_dump(), "slug": f"{slug}-{secrets.token_hex(4)}"})
    return {"id": product_id}


@router.put("/admin/products/{product_id}")
def update_product(product_id: int, form: ProductUpdate, _=Depends(require_admin)):
    with database() as cursor:
        cursor.execute("SELECT id FROM products WHERE id=%s FOR UPDATE", (product_id,))
        if not cursor.fetchone():
            raise HTTPException(404, "Product not found.")
        cursor.execute("SELECT size,stock FROM variants WHERE product_id=%s AND active=TRUE FOR UPDATE", (product_id,))
        current = {variant["size"]: variant["stock"] for variant in cursor.fetchall()}
        original = {variant.size: variant.stock for variant in form.original_variants}
        if current != original:
            raise HTTPException(409, "Stock changed while you were editing. Reopen the product before saving.")
        save_product(cursor, form.model_dump(), product_id)
    return {"id": product_id}


@router.delete("/admin/products/{product_id}", status_code=204)
def archive_product(product_id: int, _=Depends(require_admin)):
    with database() as cursor:
        cursor.execute("UPDATE products SET active=FALSE WHERE id=%s", (product_id,))


@router.post("/admin/media", status_code=201)
def upload_photo(file: UploadFile = File(), _=Depends(require_admin)):
    limit = 8 * 1024 * 1024
    content = file.file.read(limit + 1)
    if len(content) > limit:
        raise HTTPException(413, "Choose an image smaller than 8 MB.")
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        extension = "png"
    elif content.startswith(b"\xff\xd8\xff"):
        extension = "jpg"
    elif content.startswith(b"RIFF") and content[8:12] == b"WEBP":
        extension = "webp"
    else:
        raise HTTPException(415, "Choose a PNG, JPEG, or WebP image.")
    media_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{secrets.token_hex(16)}.{extension}"
    (media_dir / filename).write_bytes(content)
    return {"url": f"/api/media/{filename}"}


@router.get("/media/{filename}")
def photo(filename: str):
    if not re.fullmatch(r"[a-f0-9]{32}\.(png|jpg|webp)", filename):
        raise HTTPException(404)
    path = media_dir / filename
    if not path.is_file():
        raise HTTPException(404)
    return FileResponse(path, headers={"X-Content-Type-Options": "nosniff"})


@router.get("/admin/orders")
def orders(_=Depends(require_admin)):
    with database() as cursor:
        return order_list(cursor)


@router.post("/admin/orders/{order_id}")
def update_order(order_id: int, form: OrderAction, _=Depends(require_admin)):
    with database() as cursor:
        cursor.execute("SELECT status,confirmed FROM orders WHERE id=%s FOR UPDATE", (order_id,))
        order = cursor.fetchone()
        if not order:
            raise HTTPException(404, "Order not found.")
        if form.action == "confirm" and order["status"] == "active":
            cursor.execute("UPDATE orders SET confirmed=TRUE WHERE id=%s", (order_id,))
        elif form.action == "ship" and order["status"] == "active" and order["confirmed"]:
            cursor.execute("UPDATE orders SET status='in_transit' WHERE id=%s", (order_id,))
        elif form.action == "receive" and order["status"] == "in_transit":
            cursor.execute("UPDATE orders SET status='received' WHERE id=%s", (order_id,))
        elif form.action == "cancel" and order["status"] == "active":
            cancel_order(cursor, order_id)
        else:
            raise HTTPException(409, "This order has already changed. Refresh the order list.")
    return {"id": order_id}


@router.get("/admin/users")
def users(_=Depends(require_admin)):
    with database() as cursor:
        cursor.execute("SELECT id,username,email,role,active FROM users ORDER BY active DESC,id DESC")
        return cursor.fetchall()


def save_account(form, user_id=None):
    try:
        with database() as cursor:
            if user_id is None:
                if not form.password:
                    raise HTTPException(422, "Enter a password for the new account.")
                cursor.execute(
                    "INSERT INTO users (username,email,role,active,password_hash) VALUES (%s,%s,%s,%s,%s)",
                    (form.username, form.email, form.role, form.active, password_hash(form.password)),
                )
                return {"id": cursor.lastrowid}
            cursor.execute("SELECT id FROM users WHERE id=%s FOR UPDATE", (user_id,))
            if not cursor.fetchone():
                raise HTTPException(404, "Account not found.")
            cursor.execute(
                "UPDATE users SET username=%s,email=%s,role=%s,active=%s WHERE id=%s",
                (form.username, form.email, form.role, form.active, user_id),
            )
            if form.password:
                cursor.execute("UPDATE users SET password_hash=%s WHERE id=%s", (password_hash(form.password), user_id))
                cursor.execute("DELETE FROM password_resets WHERE user_id=%s", (user_id,))
            if not form.active or form.password:
                cursor.execute("DELETE FROM sessions WHERE user_id=%s", (user_id,))
            return {"id": user_id}
    except IntegrityError as error:
        raise HTTPException(409, "That email or username is already registered.") from error


@router.post("/admin/users", status_code=201)
def add_account(form: StaffAccount, _=Depends(require_admin)):
    return save_account(form)


@router.put("/admin/users/{user_id}")
def edit_account(user_id: int, form: StaffAccount, user=Depends(require_admin)):
    if user_id == user["id"]:
        raise HTTPException(400, "Use Account Settings to edit your own account.")
    return save_account(form, user_id)


@router.delete("/admin/users/{user_id}", status_code=204)
def disable_account(user_id: int, user=Depends(require_admin)):
    if user_id == user["id"]:
        raise HTTPException(400, "You cannot deactivate your own staff account.")
    with database() as cursor:
        cursor.execute("UPDATE users SET active=FALSE WHERE id=%s", (user_id,))
        cursor.execute("DELETE FROM sessions WHERE user_id=%s", (user_id,))
        cursor.execute("DELETE FROM password_resets WHERE user_id=%s", (user_id,))


@router.get("/admin/messages")
def messages(_=Depends(require_admin)):
    with database() as cursor:
        cursor.execute("SELECT * FROM contact_messages ORDER BY id DESC")
        return cursor.fetchall()
