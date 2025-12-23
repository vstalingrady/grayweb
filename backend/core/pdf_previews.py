"""PDF preview utilities.

Generate lightweight image previews from PDF files so staff can review uploads
without opening the original document.
"""
from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Dict, List

from backend.core.file_utils import MEDIA_UPLOAD_ROOT
from backend.logging_config import create_logger

logger = create_logger("backend.pdf_preview")

PDF_PREVIEW_DIRNAME = "previews"
PDF_PREVIEW_MAX_DIM = int(os.getenv("PDF_PREVIEW_MAX_DIM") or "1600")
PDF_PREVIEW_SCALE = float(os.getenv("PDF_PREVIEW_SCALE") or "2.0")
PDF_PREVIEW_MAX_PAGES = int(os.getenv("PDF_PREVIEW_MAX_PAGES") or "25")


def _preview_root() -> Path:
    root = (MEDIA_UPLOAD_ROOT / PDF_PREVIEW_DIRNAME).resolve()
    if not root.is_relative_to(MEDIA_UPLOAD_ROOT):
        raise RuntimeError("Preview root escapes upload directory.")
    root.mkdir(parents=True, exist_ok=True)
    return root


def preview_path_for_pdf(pdf_path: Path, page_number: int) -> Path:
    root = _preview_root()
    safe_name = f"{pdf_path.stem}-p{page_number}.png"
    candidate = (root / safe_name).resolve()
    if not candidate.is_relative_to(MEDIA_UPLOAD_ROOT):
        raise RuntimeError("Preview path escapes upload directory.")
    return candidate


def preview_paths_for_pdf(pdf_path: Path) -> Dict[int, Path]:
    root = _preview_root()
    pattern = f"{pdf_path.stem}-p*.png"
    page_map: Dict[int, Path] = {}
    for candidate in root.glob(pattern):
        match = re.search(r"-p(\d+)\.png$", candidate.name)
        if not match:
            continue
        page_map[int(match.group(1))] = candidate
    return dict(sorted(page_map.items()))


def generate_pdf_previews(pdf_path: Path) -> List[Path]:
    if not pdf_path.exists():
        logger.warning(
            "PDF preview source missing",
            extra={"path": str(pdf_path)},
        )
        return []

    try:
        import pypdfium2 as pdfium
        from PIL import Image
    except Exception as exc:
        logger.warning(
            "PDF preview dependencies unavailable",
            extra={"error": str(exc)},
        )
        return None

    pdf = None
    try:
        pdf = pdfium.PdfDocument(str(pdf_path))
        total_pages = len(pdf)
        if total_pages < 1:
            logger.warning(
                "PDF preview has no pages",
                extra={"path": str(pdf_path)},
            )
            return []

        max_pages = PDF_PREVIEW_MAX_PAGES
        if max_pages > 0:
            total_pages = min(total_pages, max_pages)

        preview_paths = [preview_path_for_pdf(pdf_path, page_number + 1) for page_number in range(total_pages)]
        if preview_paths and all(path.exists() for path in preview_paths):
            return preview_paths

        for page_number in range(total_pages):
            preview_path = preview_paths[page_number]
            if preview_path.exists():
                continue
            page = None
            temp_path = None
            try:
                page = pdf.get_page(page_number)
                bitmap = page.render(scale=PDF_PREVIEW_SCALE)
                image = bitmap.to_pil()

                if PDF_PREVIEW_MAX_DIM > 0:
                    max_dim = max(image.size)
                    if max_dim > PDF_PREVIEW_MAX_DIM:
                        scale = PDF_PREVIEW_MAX_DIM / max_dim
                        new_size = (
                            max(1, int(image.size[0] * scale)),
                            max(1, int(image.size[1] * scale)),
                        )
                        image = image.resize(new_size, Image.LANCZOS)

                preview_path.parent.mkdir(parents=True, exist_ok=True)
                temp_path = preview_path.with_suffix(preview_path.suffix + ".tmp")
                image.save(temp_path, format="PNG", optimize=True)
                temp_path.replace(preview_path)
            finally:
                if page is not None:
                    close_fn = getattr(page, "close", None)
                    if callable(close_fn):
                        close_fn()
                if temp_path and temp_path.exists():
                    temp_path.unlink(missing_ok=True)

        return preview_paths
    except Exception as exc:
        logger.warning(
            "Failed to generate PDF preview",
            extra={"path": str(pdf_path), "error": str(exc)},
        )
        return []
    finally:
        if pdf is not None:
            close_fn = getattr(pdf, "close", None)
            if callable(close_fn):
                close_fn()
