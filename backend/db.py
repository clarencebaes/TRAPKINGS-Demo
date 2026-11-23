import hashlib
import json
import os
import secrets
from contextlib import contextmanager
from decimal import Decimal
from pathlib import Path

import pymysql
from pymysql.cursors import DictCursor

ROOT = Path(__file__).resolve().parents[1]
DB_NAME = os.getenv("TRAPKINGS_DB_NAME", "trapkings_demo")
SHIP_FEE = Decimal(os.getenv("TRAPKINGS_SHIPPING_FEE", "80.00"))


@contextmanager
def database(use_database=True):
    connection = pymysql.connect(
        host=os.getenv("TRAPKINGS_DB_HOST", "127.0.0.1"),
        port=int(os.getenv("TRAPKINGS_DB_PORT", "3306")),
        user=os.getenv("TRAPKINGS_DB_USER", "root"),
        password=os.getenv("TRAPKINGS_DB_PASSWORD", ""),
        database=DB_NAME if use_database else None,
        charset="utf8mb4",
        cursorclass=DictCursor,
        connect_timeout=4,
    )
    try:
        with connection.cursor() as cursor:
            yield cursor
        connection.commit()
    except BaseException:
        connection.rollback()
        raise
    finally:
        connection.close()


def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1)
    return f"{salt}:{digest.hex()}"


def check_password(password, stored):
    return secrets.compare_digest(password_hash(password, stored.split(":")[0]), stored)


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def save_product(cursor, product, product_id=None):
    fields = (
        product["name"], product["category"], product["color"], product["price"],
        product["description"], json.dumps(product["images"]), product.get("active", True),
        product.get("featured", False),
    )
    if product_id is None:
        cursor.execute(
            "INSERT INTO products (slug,name,category,color,price,description,images,active,featured) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            (product["slug"], *fields),
        )
        product_id = cursor.lastrowid
    else:
        cursor.execute(
            "UPDATE products SET name=%s,category=%s,color=%s,price=%s,description=%s,"
            "images=%s,active=%s,featured=%s WHERE id=%s",
            (*fields, product_id),
        )
        cursor.execute("UPDATE variants SET active=FALSE WHERE product_id=%s", (product_id,))

    for variant in product["variants"]:
        cursor.execute(
            "INSERT INTO variants (product_id,size,stock) VALUES (%s,%s,%s) "
            "ON DUPLICATE KEY UPDATE stock=VALUES(stock),active=TRUE",
            (product_id, variant["size"], variant["stock"]),
        )
    return product_id


def get_products(cursor, include_inactive=False):
    cursor.execute(
        "SELECT * FROM products "
        + ("" if include_inactive else "WHERE active=TRUE ")
        + "ORDER BY created_at DESC, id DESC"
    )
    products = cursor.fetchall()
    by_id = {product["id"]: product for product in products}
    for product in products:
        product["images"] = json.loads(product["images"])
        product["variants"] = []
    cursor.execute("SELECT id,product_id,size,stock FROM variants WHERE active=TRUE ORDER BY id")
    for variant in cursor.fetchall():
        product = by_id.get(variant.pop("product_id"))
        if product is not None:
            product["variants"].append(variant)
    return products
