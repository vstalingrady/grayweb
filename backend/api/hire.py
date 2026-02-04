import os
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import databases
import sqlalchemy
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr, ValidationError
from starlette.datastructures import UploadFile as StarletteUploadFile

from backend.core.file_utils import (
    DOCUMENT_MIME_TYPES,
    MAX_MEDIA_UPLOAD_SIZE_BYTES,
    MEDIA_UPLOAD_ROOT,
    STORAGE_BASE_URL,
    persist_upload_file,
    resolve_storage_path_from_record,
)
from backend.core.pdf_previews import (
    generate_pdf_previews,
    preview_paths_for_pdf,
)
from backend.core.rate_limit import limiter
from backend.core.turnstile import verify_turnstile_token
from backend.database import get_database, hire_applications
from backend.discord_notifier import notify_hiring_submission
from backend.time_utils import utcnow
from backend.auth import get_current_user_optional, require_admin

router = APIRouter(tags=["hiring"])
_HIRING_RESUME_TOKEN = (os.getenv("HIRING_RESUME_TOKEN") or "").strip()


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
    additional_notes: Optional[str] = None
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


def _resume_token_suffix() -> str:
    if not _HIRING_RESUME_TOKEN:
        return ""
    return f"?token={_HIRING_RESUME_TOKEN}"


def _build_resume_url(*, application_id: int, storage_name: str) -> Optional[str]:
    if not _HIRING_RESUME_TOKEN:
        return None
    if STORAGE_BASE_URL:
        return f"{STORAGE_BASE_URL.rstrip('/')}/{storage_name}"

    backend_api_url = (os.getenv("BACKEND_API_URL") or "").strip()
    if backend_api_url:
        return f"{backend_api_url.rstrip('/')}/api/hire/applications/{application_id}/resume{_resume_token_suffix()}"

    site_url = (
        os.getenv("NEXT_PUBLIC_SITE_URL")
        or os.getenv("SITE_URL")
        or os.getenv("NEXT_PUBLIC_MAIN_SITE_URL")
        or ""
    ).strip()
    if site_url:
        return f"{site_url.rstrip('/')}/api/p/api/hire/applications/{application_id}/resume{_resume_token_suffix()}"
    return None


def _build_resume_preview_url(*, application_id: int) -> Optional[str]:
    if not _HIRING_RESUME_TOKEN:
        return None
    backend_api_url = (os.getenv("BACKEND_API_URL") or "").strip()
    if backend_api_url:
        return (
            f"{backend_api_url.rstrip('/')}/api/hire/applications/"
            f"{application_id}/resume-preview{_resume_token_suffix()}"
        )

    site_url = (
        os.getenv("NEXT_PUBLIC_SITE_URL")
        or os.getenv("SITE_URL")
        or os.getenv("NEXT_PUBLIC_MAIN_SITE_URL")
        or ""
    ).strip()
    if site_url:
        return (
            f"{site_url.rstrip('/')}/api/p/api/hire/applications/"
            f"{application_id}/resume-preview{_resume_token_suffix()}"
        )
    return None


def _require_resume_access(
    token: Optional[str],
    current_user: Optional[Dict[str, Any]],
) -> None:
    if _HIRING_RESUME_TOKEN:
        if token == _HIRING_RESUME_TOKEN:
            return
        if current_user:
            require_admin(current_user)
            return
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized resume access.")

    if current_user:
        require_admin(current_user)
        return

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized resume access.")


async def _parse_request_payload(
    request: Request,
) -> Tuple[HireApplicationRequest, Optional[StarletteUploadFile]]:
    content_type = (request.headers.get("content-type") or "").lower()
    resume_file: Optional[StarletteUploadFile] = None

    if "multipart/form-data" in content_type or "application/x-www-form-urlencoded" in content_type:
        form = await request.form()
        raw_data: Dict[str, Any] = {}
        for key, value in form.multi_items():
            if isinstance(value, StarletteUploadFile):
                continue
            raw_data[key] = value
        candidate = form.get("resume")
        if isinstance(candidate, StarletteUploadFile):
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


@router.get("/api/hire/applications/{application_id}/resume")
async def get_hire_resume(
    application_id: int,
    token: Optional[str] = Query(None),
    db: databases.Database = Depends(get_database),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
) -> FileResponse:
    _require_resume_access(token, current_user)

    record = await db.fetch_one(hire_applications.select().where(hire_applications.c.id == application_id))
    if not record or not record["resume_storage_path"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found.")

    storage_path = resolve_storage_path_from_record(record["resume_storage_path"])
    if not storage_path.exists():
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Resume no longer available.")

    filename = record["resume_filename"] or "resume.pdf"
    mime_type = record["resume_mime"] or "application/octet-stream"
    headers = {
        "Cache-Control": "private, max-age=86400",
        "Content-Disposition": f'attachment; filename="{filename}"',
        "X-Content-Type-Options": "nosniff",
    }
    return FileResponse(
        path=str(storage_path),
        media_type=mime_type,
        filename=filename,
        headers=headers,
    )


@router.get("/api/hire/applications/{application_id}/resume-preview")
async def get_hire_resume_preview(
    application_id: int,
    token: Optional[str] = Query(None),
    page: Optional[int] = Query(None, ge=1),
    db: databases.Database = Depends(get_database),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
) -> Response:
    _require_resume_access(token, current_user)

    record = await db.fetch_one(hire_applications.select().where(hire_applications.c.id == application_id))
    if not record or not record["resume_storage_path"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found.")

    storage_path = resolve_storage_path_from_record(record["resume_storage_path"])
    if not storage_path.exists():
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Resume no longer available.")

    preview_map = preview_paths_for_pdf(storage_path)
    if not preview_map:
        generated = generate_pdf_previews(storage_path)
        preview_map = {idx + 1: path for idx, path in enumerate(generated or [])}
    if not preview_map:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume preview not available.",
        )

    if page is not None:
        preview_path = preview_map.get(page)
        if not preview_path or not preview_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resume preview page not found.",
            )
        resume_name = record["resume_filename"] or "resume.pdf"
        preview_name = f"{Path(resume_name).stem or 'resume'}-page-{page}.png"
        headers = {
            "Cache-Control": "private, max-age=86400",
            "Content-Disposition": f'inline; filename="{preview_name}"',
            "X-Content-Type-Options": "nosniff",
        }
        return FileResponse(
            path=str(preview_path),
            media_type="image/png",
            filename=preview_name,
            headers=headers,
        )

    from fastapi.responses import HTMLResponse
    from urllib.parse import urlencode

    page_items = []
    for page_number in preview_map:
        params = {"page": page_number}
        if token:
            params["token"] = token
        page_url = f"/api/hire/applications/{application_id}/resume-preview?{urlencode(params)}"
        page_items.append((page_number, page_url))

    html_parts = [
        "<!doctype html>",
        "<html>",
        "<head>",
        "<meta charset=\"utf-8\">",
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
        "<title>Resume Preview</title>",
        "<style>",
        "body{margin:0;background:#0b0b0b;color:#f7f7f7;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;}",
        "header{padding:16px 20px;border-bottom:1px solid #1f1f1f;position:sticky;top:0;background:#0b0b0b;}",
        "main{padding:20px;display:flex;flex-direction:column;gap:24px;}",
        "img{width:100%;max-width:900px;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.4);align-self:center;}",
        ".page-label{font-size:13px;color:#b3b3b3;text-align:center;}",
        "</style>",
        "</head>",
        "<body>",
        "<header>Resume Preview</header>",
        "<main>",
    ]
    for page_number, page_url in page_items:
        html_parts.append(f"<div class=\"page-label\">Page {page_number}</div>")
        html_parts.append(f"<img src=\"{page_url}\" alt=\"Resume page {page_number}\" loading=\"lazy\">")
    html_parts.extend(["</main>", "</body>", "</html>"])

    headers = {
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
    }
    return HTMLResponse("".join(html_parts), headers=headers)


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
    additional_notes = _normalize_text(payload.additional_notes)

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
        additional_notes=additional_notes,
        user_agent=user_agent,
        ip_address=remote_ip,
        created_at=utcnow(),
    )
    application_id = await db.execute(insert_query)

    cto_count = await db.fetch_val(
        sqlalchemy.select(sqlalchemy.func.count()).select_from(hire_applications).where(hire_applications.c.role == "cto")
    )
    cmo_count = await db.fetch_val(
        sqlalchemy.select(sqlalchemy.func.count()).select_from(hire_applications).where(hire_applications.c.role == "cmo")
    )
    cto_total = int(cto_count or 0)
    cmo_total = int(cmo_count or 0)
    role_count = cto_total if role == "cto" else cmo_total
    resume_url = _build_resume_url(application_id=application_id, storage_name=storage_name)
    resume_preview_url = _build_resume_preview_url(application_id=application_id)

    background_tasks.add_task(generate_pdf_previews, storage_path)
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
            "resume_preview_url": resume_preview_url,
            "role_count": role_count,
            "cto_count": cto_total,
            "cmo_count": cmo_total,
            "total_count": cto_total + cmo_total,
            "github_url": github_url,
            "hardest_build": hardest_build,
            "tech_stack": tech_stack,
            "built_links": built_links,
            "growth_plan": growth_plan,
            "growth_take": growth_take,
            "equity_reason": equity_reason,
            "additional_notes": additional_notes,
        },
    )

    return {"status": "ok", "id": application_id}
