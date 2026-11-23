# TRAPKINGS Demo

TRAPKINGS is a streetwear storefront and store management system. It brings the shopper experience and the staff tools for managing a small clothing store into one app. The storefront is built with React, and the backend uses FastAPI and MySQL or MariaDB.

## What you can try

- **Shopper** — Browse a sample collection, filter by size and color, check availability, and consult the size guide. Register a test account, add an item to the cart, place a Cash on Delivery test order, and track its status.
- **Store staff** — Review orders and revenue summaries, manage product listings and stock by size, update fulfillment status, and read support messages. Staff can also manage shopper accounts.

The demo includes a sample product catalog and storefront artwork. The database starts without shoppers, orders, shipping details, or messages. Use fictional names and addresses while testing. Cash on Delivery exercises the order workflow locally. The demo does not collect online payments or arrange delivery.

## Run locally on Windows

Install Python 3.12, Node.js 22.12 or later, and MySQL or MariaDB. For XAMPP, start MySQL in the XAMPP Control Panel.

```powershell
git clone https://github.com/clarencebaes/TRAPKINGS-Demo.git
cd TRAPKINGS-Demo
python -m venv .venv
.venv/Scripts/Activate.ps1
python -m pip install -r backend/requirements.txt
.\Start-Trapkings.ps1
```

Open [the storefront](http://127.0.0.1:8000/). The startup script installs the frontend dependencies, builds the storefront, and initializes the separate `trapkings_demo` database and sample catalog. Apache is optional.

The local database defaults are `127.0.0.1:3306`, user `root`, and an empty password. If your local MySQL setup differs, set `TRAPKINGS_DB_HOST`, `TRAPKINGS_DB_PORT`, `TRAPKINGS_DB_USER`, and `TRAPKINGS_DB_PASSWORD` in your terminal before running the script.

### Create a staff account

In a second PowerShell terminal, activate the same environment and run the following from the project folder. Enter a password when prompted.

```powershell
.venv/Scripts/Activate.ps1
python -m backend.setup --admin-email admin@example.com
```

Sign in as `Admin` or with the example email. To try the end-to-end workflow, create a shopper account, order a product, confirm it and mark it in transit as staff, then mark it received as the shopper. Password reset email requires your own SMTP configuration.

## Project layout

| Path | Purpose |
| --- | --- |
| `frontend/` | Storefront, shopper account pages, staff dashboard, and artwork |
| `backend/` | FastAPI routes, authentication, checkout, and inventory |
| `database/` | Database schema and sample catalog |
