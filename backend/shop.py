from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException

from .accounts import require_user
from .db import SHIP_FEE, database, get_products
from .forms import CartQuantity, Checkout, Message, SupportMessage

router = APIRouter(prefix="/api")

CART_QUERY = (
    "SELECT c.variant_id,c.quantity,v.size,v.stock,p.id AS product_id,p.slug,p.name,p.color,p.price,"
    "JSON_UNQUOTE(JSON_EXTRACT(p.images,'$[0]')) AS image,(v.active AND p.active) AS available "
    "FROM carts c JOIN variants v ON c.variant_id=v.id JOIN products p ON v.product_id=p.id "
    "WHERE c.user_id=%s ORDER BY c.variant_id"
)


def cart_data(cursor, user_id, lock=False):
    cursor.execute(CART_QUERY + (" FOR UPDATE" if lock else ""), (user_id,))
    items = cursor.fetchall()
    subtotal = sum((item["price"] * item["quantity"] for item in items), Decimal("0.00"))
    shipping = SHIP_FEE if items else Decimal("0.00")
    return {"items": items, "subtotal": subtotal, "shipping": shipping, "total": subtotal + shipping}


def order_list(cursor, user_id=None):
    query = (
        "SELECT o.*,u.username,u.email,i.variant_id,i.product_name,i.size,i.color,i.price,i.quantity "
        "FROM orders o JOIN users u ON o.user_id=u.id JOIN order_items i ON o.id=i.order_id "
    )
    where = "WHERE o.user_id=%s " if user_id is not None else ""
    cursor.execute(query + where + "ORDER BY o.id DESC,i.variant_id", (user_id,) if where else ())
    orders = {}
    item_fields = ("variant_id", "product_name", "size", "color", "price", "quantity")
    for row in cursor.fetchall():
        item = {field: row.pop(field) for field in item_fields}
        order = orders.setdefault(row["id"], {**row, "items": []})
        order["items"].append(item)
    return list(orders.values())


def cancel_order(cursor, order_id):
    cursor.execute(
        "UPDATE variants v JOIN order_items i ON i.variant_id=v.id "
        "SET v.stock=v.stock+i.quantity WHERE i.order_id=%s",
        (order_id,),
    )
    cursor.execute("UPDATE orders SET status='cancelled' WHERE id=%s", (order_id,))


@router.get("/health")
def health():
    with database() as cursor:
        cursor.execute("SELECT 1")
    return {"database": "connected"}


@router.get("/products")
def products():
    with database() as cursor:
        return get_products(cursor)


@router.get("/cart")
def cart(user=Depends(require_user)):
    with database() as cursor:
        return cart_data(cursor, user["id"])


@router.put("/cart/{variant_id}")
def set_quantity(variant_id: int, form: CartQuantity, user=Depends(require_user)):
    return change_cart(user["id"], variant_id, form.quantity)


@router.post("/cart/{variant_id}/add")
def add_one(variant_id: int, user=Depends(require_user)):
    return change_cart(user["id"], variant_id, 1, increment=True)


def change_cart(user_id, variant_id, quantity, increment=False):
    with database() as cursor:
        cursor.execute("SELECT id FROM users WHERE id=%s FOR UPDATE", (user_id,))
        if increment:
            cursor.execute("SELECT quantity FROM carts WHERE user_id=%s AND variant_id=%s", (user_id, variant_id))
            line = cursor.fetchone()
            quantity += line["quantity"] if line else 0
        if quantity == 0:
            cursor.execute("DELETE FROM carts WHERE user_id=%s AND variant_id=%s", (user_id, variant_id))
        else:
            cursor.execute(
                "SELECT v.stock FROM variants v JOIN products p ON p.id=v.product_id "
                "WHERE v.id=%s AND v.active=TRUE AND p.active=TRUE FOR UPDATE",
                (variant_id,),
            )
            variant = cursor.fetchone()
            if not variant or quantity > min(variant["stock"], 99):
                raise HTTPException(409, "That quantity is unavailable.")
            cursor.execute(
                "INSERT INTO carts VALUES (%s,%s,%s) ON DUPLICATE KEY UPDATE quantity=VALUES(quantity)",
                (user_id, variant_id, quantity),
            )
        return cart_data(cursor, user_id)


@router.post("/checkout", status_code=201)
def checkout(form: Checkout, user=Depends(require_user)):
    user_id = user["id"]
    with database() as cursor:
        cursor.execute("SELECT id FROM users WHERE id=%s FOR UPDATE", (user_id,))
        basket = cart_data(cursor, user_id, lock=True)
        if not basket["items"]:
            raise HTTPException(400, "Your cart is empty.")
        for item in basket["items"]:
            if not item["available"] or item["quantity"] > item["stock"]:
                raise HTTPException(409, f"Update your cart. {item['name']} ({item['size']}) has insufficient stock.")
        cursor.execute(
            "INSERT INTO orders (user_id,full_name,address,phone,note,subtotal,shipping,total) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
            (user_id, form.full_name, form.address, form.phone, form.note,
             basket["subtotal"], basket["shipping"], basket["total"]),
        )
        order_id = cursor.lastrowid
        for item in basket["items"]:
            cursor.execute("UPDATE variants SET stock=stock-%s WHERE id=%s", (item["quantity"], item["variant_id"]))
            cursor.execute(
                "INSERT INTO order_items VALUES (%s,%s,%s,%s,%s,%s,%s)",
                (order_id, item["variant_id"], item["name"], item["size"], item["color"], item["price"], item["quantity"]),
            )
        cursor.execute("DELETE FROM carts WHERE user_id=%s", (user_id,))
        return {"id": order_id, "total": basket["total"]}


@router.get("/orders")
def my_orders(user=Depends(require_user)):
    with database() as cursor:
        return order_list(cursor, user["id"])


@router.post("/orders/{order_id}/cancel", status_code=204)
def cancel_own_order(order_id: int, user=Depends(require_user)):
    with database() as cursor:
        cursor.execute("SELECT status FROM orders WHERE id=%s AND user_id=%s FOR UPDATE", (order_id, user["id"]))
        order = cursor.fetchone()
        if not order:
            raise HTTPException(404, "Order not found.")
        if order["status"] != "active":
            raise HTTPException(409, "Only active orders can be cancelled.")
        cancel_order(cursor, order_id)


@router.post("/orders/{order_id}/receive", status_code=204)
def receive_own_order(order_id: int, user=Depends(require_user)):
    with database() as cursor:
        cursor.execute(
            "UPDATE orders SET status='received' WHERE id=%s AND user_id=%s AND status='in_transit'",
            (order_id, user["id"]),
        )
        if cursor.rowcount == 0:
            raise HTTPException(409, "This order is unavailable or no longer in transit.")


@router.post("/contact", status_code=201)
def contact(form: Message):
    with database() as cursor:
        cursor.execute(
            "INSERT INTO contact_messages (name,email,message,kind) VALUES (%s,%s,%s,'contact')",
            (form.name, form.email, form.message),
        )
    return {"message": "Your message was sent."}


@router.post("/support", status_code=201)
def support(form: SupportMessage, user=Depends(require_user)):
    with database() as cursor:
        cursor.execute(
            "INSERT INTO contact_messages (name,email,message,kind) VALUES (%s,%s,%s,%s)",
            (user["full_name"] or user["username"], user["email"], form.message, form.kind),
        )
    return {"message": "Your request was sent."}
