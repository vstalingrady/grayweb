import pytest

from backend.core.link_preview import (
    _is_disallowed_hostname,
    build_image_proxy_path,
    extract_preview_metadata,
    normalize_preview_target_url,
)


def test_extract_preview_metadata_prefers_open_graph_image_and_resolves_relative_url() -> None:
    document = """
    <html>
      <head>
        <title>Fallback Title</title>
        <meta property="og:title" content="The Fox (What Does the Fox Say?)" />
        <meta property="og:description" content="A novelty dance song by Ylvis." />
        <meta property="og:image" content="/wikipedia/en/e/e0/Ylvis-TheFox.jpg" />
        <meta property="og:site_name" content="Wikipedia" />
      </head>
    </html>
    """
    metadata = extract_preview_metadata(document, base_url="https://upload.wikimedia.org/wiki/The_Fox")

    assert metadata["title"] == "The Fox (What Does the Fox Say?)"
    assert metadata["description"] == "A novelty dance song by Ylvis."
    assert metadata["site_name"] == "Wikipedia"
    assert metadata["image_url"] == "https://upload.wikimedia.org/wikipedia/en/e/e0/Ylvis-TheFox.jpg"


def test_extract_preview_metadata_uses_twitter_image_when_open_graph_missing() -> None:
    document = """
    <html>
      <head>
        <meta name="twitter:image" content="https://cdn.example.com/fox-card.png" />
      </head>
    </html>
    """

    metadata = extract_preview_metadata(document, base_url="https://example.com/page")
    assert metadata["image_url"] == "https://cdn.example.com/fox-card.png"


def test_normalize_preview_target_url_adds_https_scheme_for_bare_host() -> None:
    assert normalize_preview_target_url("en.wikipedia.org/wiki/The_Fox") == "https://en.wikipedia.org/wiki/The_Fox"


def test_normalize_preview_target_url_rejects_non_http_scheme() -> None:
    with pytest.raises(ValueError, match="Only http/https URLs are allowed"):
        normalize_preview_target_url("javascript:alert(1)")


def test_disallowed_hostname_blocks_local_and_private_hosts() -> None:
    assert _is_disallowed_hostname("localhost") is True
    assert _is_disallowed_hostname("127.0.0.1") is True
    assert _is_disallowed_hostname("192.168.1.20") is True
    assert _is_disallowed_hostname("en.wikipedia.org") is False


def test_build_image_proxy_path_encodes_target_url() -> None:
    proxy_path = build_image_proxy_path("https://upload.wikimedia.org/wikipedia/en/e/e0/Ylvis-TheFox.jpg")
    assert proxy_path.startswith("/api/link-preview/image?url=")
    assert "https%3A%2F%2Fupload.wikimedia.org%2Fwikipedia%2Fen%2Fe%2Fe0%2FYlvis-TheFox.jpg" in proxy_path
