# Midtrans Reference Docs Scrape

This repository now includes a structured scrape of all pages under:

- `https://docs.midtrans.com/reference`

**Output JSON**

- File: `midtrans_reference.json`
- Size: ~6.8MB
- Pages crawled: 293

Each entry is shaped like:

```json
{
  "url": "https://docs.midtrans.com/reference/...",
  "title": "Page Title",
  "headings": [{"level": 1, "text": "..."}, {"level": 2, "text": "..."}],
  "text": "Cleaned text content with headings inline",
  "links": ["https://docs.midtrans.com/reference/other-page", "..."],
  "status_code": 200
}
```

Notes:
- A few discovered links returned `404` (kept in JSON with their `status_code`).
- The crawler only follows internal links whose path starts with `/reference`.

If you want me to also scrape `https://docs.midtrans.com/docs/` or merge both into one JSON, tell me the scope.

