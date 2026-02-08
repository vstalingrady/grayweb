from backend.core.ai_utils import openrouter_annotations_to_grounding


def test_url_citation_maps_snippet_image_and_offsets() -> None:
    result = openrouter_annotations_to_grounding(
        [
            {
                "type": "url_citation",
                "url_citation": {
                    "url": "https://example.com/article",
                    "title": "Example title",
                    "content": "  Example snippet text  ",
                    "thumbnail_url": "https://cdn.example.com/cover.jpg",
                    "start_index": 11,
                    "end_index": 37,
                },
            }
        ]
    )

    assert result is not None
    assert result["grounding_chunks"] == [
        {
            "web": {
                "uri": "https://example.com/article",
                "title": "Example title",
                "snippet": "Example snippet text",
                "image_url": "https://cdn.example.com/cover.jpg",
            }
        }
    ]
    assert result["grounding_supports"] == [
        {"segment": {"start_index": 11, "end_index": 37}, "grounding_chunk_indices": [0]}
    ]


def test_url_citation_rejects_invalid_media_and_normalizes_protocol_relative_url() -> None:
    result = openrouter_annotations_to_grounding(
        [
            {
                "type": "url_citation",
                "url_citation": {
                    "url": "https://example.com/no-image",
                    "title": "No image",
                    "image_url": "javascript:alert(1)",
                    "content": "safe snippet",
                },
                "thumbnailUrl": "//img.example.com/thumb.webp",
            }
        ]
    )

    assert result is not None
    web = result["grounding_chunks"][0]["web"]
    assert web["uri"] == "https://example.com/no-image"
    assert web["title"] == "No image"
    assert web["snippet"] == "safe snippet"
    assert web["image_url"] == "https://img.example.com/thumb.webp"
