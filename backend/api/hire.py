from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import databases
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, UploadFile, status
from pydantic import BaseModel, EmailStr, ValidationError

from backend.core.file_utils import (
    DOCUMENT_MIME_TYPES,
    MAX_MEDIA_UPLOAD_SIZE_BYTES,
    MEDIA_UPLOAD_ROOT,
    STORAGE_BASE_URL,
    persist_upload_file,
)
from backend.core.rate_limit import limiter
from backend.core.turnstile import verify_turnstile_token
from backend.database import get_database, hire_applications
from backend.discord_notifier import notify_hiring_submission
from backend.time_utils import utcnow

router = APIRouter(tags=["hiring"])


class HireApplicationRequest(BaseModel):
    role: str
    name: str
    email: EmailStr
    location: Optional[str] = None
    university_background: Optional[str] = None
    major_field: Optional[str] = None
    linkedin_url: Optional[str] = None
    social_links: Optional[str] = None
    interest_reason: Optional[str] = None
    alignment_vision: Optional[str] = None
    studies_balance: Optional[str] = None
    github_url: Optional[str] = None
    hardest_build: Optional[str] = None
    tech_stack: Optional[str] = None
    built_links: Optional[str] = None
    growth_plan: Optional[str] = None
    growth_take: Optional[str] = None
    equity_reason: Optional[str] = None
    captcha_token: Optional[str] = None


def _normalize_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _count_words(value: str) -> int:
    return len(value.strip().split())


def _require_field(value: Optional[str], label: str) -> str:
    cleaned = _normalize_text(value)
    if not cleaned:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{label} is required.")
    return cleaned


def _ensure_word_limit(value: Optional[str], limit: int, label: str) -> None:
    if not value:
        return
    if _count_words(value) > limit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{label} exceeds {limit} words.",
        )


async def _parse_request_payload(
    request: Request,
) -> Tuple[HireApplicationRequest, Optional[UploadFile]]:
    content_type = (request.headers.get("content-type") or "").lower()
    resume_file: Optional[UploadFile] = None

    if "multipart/form-data" in content_type or "application/x-www-form-urlencoded" in content_type:
        form = await request.form()
        raw_data: Dict[str, Any] = {}
        for key, value in form.multi_items():
            if isinstance(value, UploadFile):
                continue
            raw_data[key] = value
        candidate = form.get("resume")
        if isinstance(candidate, UploadFile):
            resume_file = candidate
    else:
        try:
            raw_data = await request.json()
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid request payload.",
            ) from exc

    try:
        payload = HireApplicationRequest(**raw_data)
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid request payload.",
        ) from exc

    return payload, resume_file


@router.post("/api/hire/applications", status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def create_hire_application(
    request: Request,
    background_tasks: BackgroundTasks,
    db: databases.Database = Depends(get_database),
) -> Dict[str, Any]:
    payload, resume_file = await _parse_request_payload(request)

    role = _normalize_text(payload.role)
    if not role:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Role is required.")
    role = role.lower()
    if role not in {"cto", "cmo"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Role must be CTO or CMO.")

    name = _require_field(payload.name, "Name")
    email = (_normalize_text(str(payload.email)) or "").lower()
    location = _require_field(payload.location, "Location")
    university_background = _require_field(payload.university_background, "University/background")
    major_field = _require_field(payload.major_field, "Major/Field of Study")
    linkedin_url = _require_field(payload.linkedin_url, "LinkedIn")
    social_links = _require_field(payload.social_links, "X or Instagram")
    interest_reason = _require_field(payload.interest_reason, "Why Gray")
    alignment_vision = _require_field(payload.alignment_vision, "Alignment vision")
    studies_balance = _require_field(payload.studies_balance, "Studies balance")
    equity_reason = _require_field(payload.equity_reason, "Equity-only reasoning")

    github_url = _normalize_text(payload.github_url)
    hardest_build = _normalize_text(payload.hardest_build)
    tech_stack = _normalize_text(payload.tech_stack)
    built_links = _normalize_text(payload.built_links)
    growth_plan = _normalize_text(payload.growth_plan)
    growth_take = _normalize_text(payload.growth_take)

    _ensure_word_limit(interest_reason, 100, "Why Gray")
    _ensure_word_limit(alignment_vision, 100, "Alignment vision")
    _ensure_word_limit(studies_balance, 100, "Studies balance")
    _ensure_word_limit(equity_reason, 100, "Equity-only reasoning")

    if role == "cto":
        github_url = _require_field(github_url, "GitHub link")
        hardest_build = _require_field(hardest_build, "Hardest technical thing")
        tech_stack = _require_field(tech_stack, "Tech stack explanation")
        _ensure_word_limit(hardest_build, 150, "Hardest technical thing")
        _ensure_word_limit(tech_stack, 150, "Tech stack explanation")
    else:
        built_links = _require_field(built_links, "Built/growth links")
        growth_plan = _require_field(growth_plan, "Growth plan")
        growth_take = _require_field(growth_take, "Growth take")
        _ensure_word_limit(growth_plan, 150, "Growth plan")
        _ensure_word_limit(growth_take, 100, "Growth take")

    if resume_file is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Resume/CV is required.")

    token = _normalize_text(payload.captcha_token)
    remote_ip = request.client.host if request.client else None
    verified, error_message = await verify_turnstile_token(token, remote_ip=remote_ip)
    if not verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_message or "Turnstile verification failed.",
        )

    storage_path, resume_mime, resume_size, resume_filename, storage_name = await persist_upload_file(
        resume_file,
        allowed_mime_types=DOCUMENT_MIME_TYPES,
        allowed_extensions={".pdf"},
        max_size_bytes=MAX_MEDIA_UPLOAD_SIZE_BYTES,
    )
    await resume_file.close()
    try:
        storage_path_for_db = storage_path.relative_to(MEDIA_UPLOAD_ROOT)
    except ValueError:
        storage_path_for_db = Path(storage_name)
    resume_storage_path = str(storage_path_for_db)
    resume_url = (
        f"{STORAGE_BASE_URL.rstrip('/')}/{storage_name}"
        if STORAGE_BASE_URL
        else None
    )

    user_agent = _normalize_text(request.headers.get("user-agent"))

    insert_query = hire_applications.insert().values(
        role=role,
        full_name=name,
        email=email,
        location=location,
        university_background=university_background,
        major_field=major_field,
        linkedin_url=linkedin_url,
        social_links=social_links,
        interest_reason=interest_reason,
        alignment_vision=alignment_vision,
        studies_balance=studies_balance,
        resume_filename=resume_filename,
        resume_mime=resume_mime,
        resume_size=resume_size,
        resume_storage_path=resume_storage_path,
        github_url=github_url,
        hardest_build=hardest_build,
        tech_stack=tech_stack,
        built_links=built_links,
        growth_plan=growth_plan,
        growth_take=growth_take,
        equity_reason=equity_reason,
        user_agent=user_agent,
        ip_address=remote_ip,
        created_at=utcnow(),
    )
    application_id = await db.execute(insert_query)

    background_tasks.add_task(
        notify_hiring_submission,
        {
            "application_id": application_id,
            "role": role,
            "name": name,
            "email": email,
            "location": location,
            "university_background": university_background,
            "major_field": major_field,
            "linkedin_url": linkedin_url,
            "social_links": social_links,
            "interest_reason": interest_reason,
            "alignment_vision": alignment_vision,
            "studies_balance": studies_balance,
            "resume_filename": resume_filename,
            "resume_mime": resume_mime,
            "resume_size": resume_size,
            "resume_storage_path": resume_storage_path,
            "resume_url": resume_url,
            "github_url": github_url,
            "hardest_build": hardest_build,
            "tech_stack": tech_stack,
            "built_links": built_links,
            "growth_plan": growth_plan,
            "growth_take": growth_take,
            "equity_reason": equity_reason,
        },
    )

    return {"status": "ok", "id": application_id}
