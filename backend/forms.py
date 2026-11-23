from decimal import Decimal
import re
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints, field_validator

Password = Annotated[str, StringConstraints(strip_whitespace=False, min_length=8, max_length=128)]
OptionalPassword = Annotated[str, StringConstraints(strip_whitespace=False, max_length=128)]


class Form(BaseModel):
    model_config = {"str_strip_whitespace": True, "extra": "forbid"}


class Credentials(Form):
    model_config = {"str_strip_whitespace": False}
    email: str = Field(min_length=2, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class Account(Form):
    username: str = Field(min_length=2, max_length=60)
    email: str = Field(min_length=5, max_length=254)

    @field_validator("email")
    @classmethod
    def valid_email(cls, value):
        local, _, domain = value.rpartition("@")
        if not local or "." not in domain or "@" in local or any(c.isspace() for c in value):
            raise ValueError("Enter a valid email address")
        return value.lower()


class Registration(Account):
    password: Password


class StaffAccount(Account):
    role: Literal["admin", "shopper"]
    active: bool = True
    password: OptionalPassword = ""

    @field_validator("password")
    @classmethod
    def password_length(cls, value):
        if value and len(value) < 8:
            raise ValueError("Use at least 8 characters")
        return value


class PasswordChange(BaseModel):
    current: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=8, max_length=128)


class ResetPassword(BaseModel):
    token: str = Field(min_length=32, max_length=128)
    password: str = Field(min_length=8, max_length=128)


class ResetRequest(Form):
    email: str = Field(min_length=5, max_length=254)


class Shipping(Form):
    full_name: str = Field(min_length=2, max_length=120)
    address: str = Field(min_length=5, max_length=500)
    phone: str = Field(min_length=5, max_length=40)
    note: str = Field(default="", max_length=250)


class Checkout(Shipping):
    accept_terms: Literal[True]


class CartQuantity(Form):
    quantity: int = Field(ge=0, le=99)


class Variant(Form):
    size: str = Field(min_length=1, max_length=20)
    stock: int = Field(ge=0, le=999999)


class Product(Form):
    name: str = Field(min_length=1, max_length=120)
    category: str = Field(min_length=1, max_length=50)
    color: str = Field(min_length=1, max_length=50)
    price: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    description: str = Field(max_length=5000)
    images: list[str] = Field(min_length=1, max_length=8)
    variants: list[Variant] = Field(min_length=1, max_length=30)
    active: bool = True
    featured: bool = False

    @field_validator("images")
    @classmethod
    def local_images(cls, values):
        if any(not re.fullmatch(r"/(?:images|api/media)/[a-zA-Z0-9_-]+\.(?:webp|png|jpe?g)", v) for v in values):
            raise ValueError("Use an uploaded image or a catalog image path")
        return values

    @field_validator("variants")
    @classmethod
    def unique_sizes(cls, values):
        if len({v.size.casefold() for v in values}) != len(values):
            raise ValueError("Each size can appear only once")
        return values


class ProductUpdate(Product):
    original_variants: list[Variant] = Field(min_length=1, max_length=30)


class Message(Form):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=254)
    message: str = Field(min_length=5, max_length=3500)


class SupportMessage(Form):
    kind: Literal["return", "support"]
    message: str = Field(min_length=5, max_length=3500)


class OrderAction(BaseModel):
    action: Literal["confirm", "ship", "receive", "cancel"]
