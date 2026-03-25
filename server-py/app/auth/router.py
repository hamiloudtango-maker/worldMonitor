import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.deps import CurrentUser, get_current_user
from app.auth.schemas import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from app.auth.service import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db import get_db
from app.models.org import Org
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def _make_slug(name: str) -> str:
    return _SLUG_RE.sub("-", name.lower()).strip("-")[:100]


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check email uniqueness
    existing = await db.scalar(select(User).where(User.email == body.email))
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

    # Create org
    slug = _make_slug(body.org_name)
    existing_org = await db.scalar(select(Org).where(Org.slug == slug))
    if existing_org:
        slug = f"{slug}-{hash(body.email) % 10000:04d}"

    org = Org(name=body.org_name, slug=slug)
    db.add(org)
    await db.flush()

    # Create user (owner)
    user = User(
        org_id=org.id,
        email=body.email,
        password_hash=hash_password(body.password),
        role="owner",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return TokenResponse(
        access_token=create_access_token(user.id, org.id),
        refresh_token=create_refresh_token(user.id, org.id),
    )


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.email == body.email))
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")

    return TokenResponse(
        access_token=create_access_token(user.id, user.org_id),
        refresh_token=create_refresh_token(user.id, user.org_id),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest):
    import jwt as pyjwt

    try:
        payload = decode_token(body.refresh_token)
    except pyjwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")

    if payload.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not a refresh token")

    from uuid import UUID

    user_id = UUID(payload["sub"])
    org_id = UUID(payload["org"])

    return TokenResponse(
        access_token=create_access_token(user_id, org_id),
        refresh_token=create_refresh_token(user_id, org_id),
    )


@router.get("/me", response_model=UserResponse)
async def me(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).options(selectinload(User.org)).where(User.id == current_user.user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    return UserResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        org_id=user.org_id,
        org_name=user.org.name,
        created_at=user.created_at,
    )
