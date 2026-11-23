import logging
from urllib.parse import urlsplit

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pymysql.err import OperationalError

from . import accounts, admin, shop
from .db import ROOT

app = FastAPI(title="TRAPKINGS API")
app.include_router(accounts.router)
app.include_router(shop.router)
app.include_router(admin.router)


@app.middleware("http")
async def validate_origin(request: Request, call_next):
    origin = request.headers.get("origin")
    if request.method in {"POST", "PUT", "DELETE", "PATCH"} and origin:
        if urlsplit(origin).netloc != request.headers.get("host"):
            return JSONResponse({"detail": "Request origin is not allowed."}, status_code=403)
    return await call_next(request)


@app.exception_handler(OperationalError)
async def database_unavailable(_request, error):
    logging.getLogger(__name__).warning("Database operation failed (%s)", error.args[0])
    return JSONResponse({"detail": "The database is temporarily unavailable. Please retry."}, status_code=503)


dist = ROOT / "frontend" / "dist"
if (dist / "index.html").is_file():
    app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")
    app.mount("/images", StaticFiles(directory=dist / "images"), name="images")

    @app.get("/{path:path}", include_in_schema=False)
    def storefront(path: str):
        if path == "api" or path.startswith("api/"):
            raise HTTPException(404)
        return FileResponse(dist / "index.html")
