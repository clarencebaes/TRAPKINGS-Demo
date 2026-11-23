import argparse
import getpass
import json
import re

from .db import DB_NAME, ROOT, database, password_hash, save_product


def main():
    parser = argparse.ArgumentParser(description="Initialize the TRAPKINGS database.")
    parser.add_argument("--admin-email", help="Create a new staff account with this email")
    parser.add_argument("--admin-username", default="Admin")
    parser.add_argument("--no-seed", action="store_true", help="Skip the sample catalog")
    args = parser.parse_args()

    if not re.fullmatch(r"[A-Za-z0-9_]{1,64}", DB_NAME):
        parser.error("TRAPKINGS_DB_NAME must use letters, digits, and underscores")
    password = None
    if args.admin_email:
        password = getpass.getpass("New staff password (at least 8 characters): ")
        if not 8 <= len(password) <= 128:
            parser.error("Use between 8 and 128 characters for the staff password")

    with database(use_database=False) as cursor:
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")

    with database() as cursor:
        for statement in (ROOT / "database/schema.sql").read_text().split(";"):
            if statement.strip():
                cursor.execute(statement)
        if not args.no_seed:
            catalog = json.loads((ROOT / "database/catalog.json").read_text(encoding="utf-8"))
            for position, product in enumerate(catalog, start=1):
                cursor.execute("SELECT id FROM products WHERE slug=%s", (product["slug"],))
                if not cursor.fetchone():
                    product_id = save_product(cursor, product)
                    cursor.execute(
                        "UPDATE products SET created_at=CURRENT_TIMESTAMP - INTERVAL %s SECOND WHERE id=%s",
                        (position, product_id),
                    )
        if password is not None:
            cursor.execute(
                "INSERT INTO users (username,email,password_hash,role) VALUES (%s,%s,%s,'admin')",
                (args.admin_username.strip(), args.admin_email.strip().lower(), password_hash(password)),
            )

    print(f"Initialized {DB_NAME}.")


if __name__ == "__main__":
    main()
