
from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    StringConstraints,
    model_validator,
)


# =====================================================
# ROLE DEFINITIONS
# =====================================================

UserRole = Literal["admin", "user", "reviewer"]

Password = Annotated[
    str,
    StringConstraints(min_length=8, max_length=128),
]


# =====================================================
# AUTHENTICATION SCHEMAS
# =====================================================

class RegisterRequest(BaseModel):
    email: EmailStr = Field(max_length=255)
    password: Password


class LoginRequest(BaseModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=1, max_length=128)


class TokenRead(BaseModel):
    access_token: str
    token_type: str = "bearer"


# =====================================================
# USER RESPONSE
# =====================================================

class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    company_id: UUID | None
    email: EmailStr
    role: UserRole
    is_active: bool
    created_at: datetime


class RegisterRead(TokenRead):
    user: UserRead


# =====================================================
# ADMIN - CREATE USER
# =====================================================

class UserCreate(BaseModel):
    email: EmailStr = Field(max_length=255)
    password: Password

    role: UserRole = "user"


# =====================================================
# ADMIN - UPDATE USER ROLE
# =====================================================

class UserRoleUpdate(BaseModel):
    role: UserRole


# =====================================================
# ADMIN - UPDATE ACCOUNT STATUS
# =====================================================

class UserStatusUpdate(BaseModel):
    is_active: bool


# =====================================================
# ADMIN - UPDATE USER DETAILS
# =====================================================

class UserUpdate(BaseModel):
    email: EmailStr | None = Field(
        default=None,
        max_length=255,
    )

    @model_validator(mode="after")
    def validate_changes(self):
        if not self.model_fields_set:
            raise ValueError(
                "At least one field must be provided"
            )

        if (
            "email" in self.model_fields_set
            and self.email is None
        ):
            raise ValueError("email cannot be null")

        return self


# =====================================================
# USER LIST RESPONSE
# =====================================================

class UserListResponse(BaseModel):
    total: int = Field(ge=0)
    items: list[UserRead]
