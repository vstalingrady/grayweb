#!/usr/bin/env python3
"""
Scrape all pages under https://docs.midtrans.com/reference.

Outputs a JSON array of page objects:
{
  "url": "...",
  "title": "...",
  "headings": [{"level": 1, "text": "..."}, ...],
  "text": "...",
  "links": ["...", ...],
  "status_code": 200
}

Usage:
  python scripts/midtrans_scrape_reference.py --out midtrans_reference.json
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
from collections import deque
from dataclasses import dataclass
from html import unescape
from html.parser import HTMLParser
from typing import Deque, Dict, List, Optional, Set, Tuple
from urllib.parse import urljoin, urlparse, urlunparse

import httpx


REFERENCE_ROOT = "https://docs.midtrans.com/reference"
ALLOWED_NETLOC = "docs.midtrans.com"
DEFAULT_MAX_PAGES = 500
DEFAULT_REQUEST_DELAY_SECONDS = 0.4
USER_AGENT = "gray-docs-scraper/1.0 (+https://docs.midtrans.com)"


def normalize_url(url: str) -> str:
    parsed = urlparse(url)
    parsed = parsed._replace(fragment="", query="")
    if parsed.scheme == "":
        parsed = parsed._replace(scheme="https")
    if parsed.netloc == "":
        parsed = parsed._replace(netloc=ALLOWED_NETLOC)
    normalized_path = re.sub(r"/{2,}", "/", parsed.path)
    if normalized_path != "/" and normalized_path.endswith("/"):
        normalized_path = normalized_path[:-1]
    parsed = parsed._replace(path=normalized_path)
    return urlunparse(parsed)


def is_reference_url(url: str) -> bool:
    parsed = urlparse(url)
    if parsed.netloc and parsed.netloc != ALLOWED_NETLOC:
        return False
    path = parsed.path or ""
    return path.startswith("/reference")


@dataclass
class ParsedPage:
    title: str
    headings: List[Tuple[int, str]]
    text: str
    links: List[str]


class MidtransHTMLParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.in_ignored_tag = False
        self.ignored_tag_stack: List[str] = []
        self.current_heading_level: Optional[int] = None
        self.headings: List[Tuple[int, str]] = []
        self.text_parts: List[str] = []
        self.links: Set[str] = set()
        self.title_parts: List[str] = []
        self.in_title = False

    def handle_starttag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]) -> None:
        tag_lower = tag.lower()
        attrs_dict = dict(attrs)

        if tag_lower in {"script", "style", "nav", "footer", "noscript"}:
            self.in_ignored_tag = True
            self.ignored_tag_stack.append(tag_lower)
            return

        if tag_lower == "title":
            self.in_title = True

        if tag_lower in {"h1", "h2", "h3", "h4"}:
            try:
                self.current_heading_level = int(tag_lower[1])
            except ValueError:
                self.current_heading_level = None

        if tag_lower == "a":
            href = attrs_dict.get("href")
            if href:
                self.links.add(href)

        if tag_lower in {"p", "br", "li", "section", "div"}:
            self.text_parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        tag_lower = tag.lower()
        if self.in_ignored_tag:
            if self.ignored_tag_stack and self.ignored_tag_stack[-1] == tag_lower:
                self.ignored_tag_stack.pop()
            if not self.ignored_tag_stack:
                self.in_ignored_tag = False
            return

        if tag_lower == "title":
            self.in_title = False

        if tag_lower in {"h1", "h2", "h3", "h4"}:
            self.current_heading_level = None
            self.text_parts.append("\n")

    def handle_data(self, data: str) -> None:
        if self.in_ignored_tag:
            return
        cleaned = unescape(data).strip()
        if not cleaned:
            return

        if self.in_title:
            self.title_parts.append(cleaned)

        if self.current_heading_level is not None:
            self.headings.append((self.current_heading_level, cleaned))
            self.text_parts.append(f"{'#' * self.current_heading_level} {cleaned}\n")
        else:
            self.text_parts.append(cleaned + " ")

    def get_parsed_page(self) -> ParsedPage:
        raw_text = "".join(self.text_parts)
        raw_text = re.sub(r"[ \t]+\n", "\n", raw_text)
        raw_text = re.sub(r"\n{3,}", "\n\n", raw_text)
        raw_text = re.sub(r"[ \t]{2,}", " ", raw_text)
        title = " ".join(self.title_parts).strip()
        return ParsedPage(
            title=title,
            headings=self.headings,
            text=raw_text.strip(),
            links=sorted(self.links),
        )


async def fetch_page(client: httpx.AsyncClient, url: str) -> Tuple[int, str]:
    response = await client.get(url, follow_redirects=True, timeout=30)
    return response.status_code, response.text


async def crawl_reference(
    start_url: str,
    max_pages: int,
    delay_seconds: float,
    verbose: bool,
) -> List[Dict]:
    queue: Deque[str] = deque([normalize_url(start_url)])
    visited: Set[str] = set()
    pages: List[Dict] = []

    async with httpx.AsyncClient(headers={"User-Agent": USER_AGENT}) as client:
        while queue and len(pages) < max_pages:
            url = queue.popleft()
            if url in visited:
                continue
            visited.add(url)

            try:
                status_code, html_text = await fetch_page(client, url)
            except Exception as exc:
                pages.append(
                    {
                        "url": url,
                        "title": "",
                        "headings": [],
                        "text": "",
                        "links": [],
                        "status_code": 0,
                        "error": str(exc),
                    }
                )
                await asyncio.sleep(REQUEST_DELAY_SECONDS)
                continue

            if verbose:
                print(f"[{len(pages)+1}] {url} ({status_code})", flush=True)

            parser = MidtransHTMLParser()
            parser.feed(html_text)
            parsed_page = parser.get_parsed_page()

            normalized_links: List[str] = []
            for link in parsed_page.links:
                absolute = normalize_url(urljoin(url, link))
                if is_reference_url(absolute):
                    normalized_links.append(absolute)
                    if absolute not in visited:
                        queue.append(absolute)

            pages.append(
                {
                    "url": url,
                    "title": parsed_page.title,
                    "headings": [
                        {"level": level, "text": text}
                        for level, text in parsed_page.headings
                    ],
                    "text": parsed_page.text,
                    "links": normalized_links,
                    "status_code": status_code,
                }
            )

            await asyncio.sleep(delay_seconds)

    return pages


def main() -> None:
    argument_parser = argparse.ArgumentParser()
    argument_parser.add_argument(
        "--start",
        default=REFERENCE_ROOT,
        help="Start URL (default: reference root)",
    )
    argument_parser.add_argument(
        "--out",
        default="midtrans_reference.json",
        help="Output JSON file path",
    )
    argument_parser.add_argument(
        "--max-pages",
        type=int,
        default=DEFAULT_MAX_PAGES,
        help=f"Maximum pages to crawl (default: {DEFAULT_MAX_PAGES})",
    )
    argument_parser.add_argument(
        "--delay",
        type=float,
        default=DEFAULT_REQUEST_DELAY_SECONDS,
        help=f"Delay between requests in seconds (default: {DEFAULT_REQUEST_DELAY_SECONDS})",
    )
    argument_parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print progress while crawling",
    )
    args = argument_parser.parse_args()

    pages = asyncio.run(
        crawl_reference(
            args.start,
            max_pages=args.max_pages,
            delay_seconds=args.delay,
            verbose=args.verbose,
        )
    )
    with open(args.out, "w", encoding="utf-8") as output_file:
        json.dump(pages, output_file, ensure_ascii=False, indent=2)

    print(f"Wrote {len(pages)} pages to {args.out}")


if __name__ == "__main__":
    main()
