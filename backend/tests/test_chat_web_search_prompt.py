from backend.api.chat import _build_effective_web_search_prompt
from backend.api.chat_models import ChatRequest


def _build_request(message: str) -> ChatRequest:
    return ChatRequest(message=message, user_id=1)


def test_follow_up_prompt_anchors_recent_assistant_context() -> None:
    request = _build_request("what did he have actually")
    history = [
        {"role": "user", "text": "okay tell me about sad story of a human"},
        {
            "role": "model",
            "text": (
                "There was a man named Joseph Merrick, known as the Elephant Man. "
                "His condition caused progressive deformities."
            ),
        },
    ]

    prompt = _build_effective_web_search_prompt(request, conversation_history=history)

    assert prompt is not None
    assert "Recent assistant context to anchor follow-up search:" in prompt
    assert "Joseph Merrick" in prompt
    assert "timezone metadata" in prompt


def test_non_follow_up_prompt_omits_context_anchors() -> None:
    request = _build_request("latest AI safety news")
    history = [
        {"role": "user", "text": "tell me about x"},
        {"role": "model", "text": "here is x"},
    ]

    prompt = _build_effective_web_search_prompt(request, conversation_history=history)

    assert prompt is not None
    assert "Recent user context to anchor follow-up search:" not in prompt
    assert "Recent assistant context to anchor follow-up search:" not in prompt


def test_low_information_search_turn_anchors_recent_context() -> None:
    request = _build_request("search")
    history = [
        {"role": "user", "text": "was pope john paul in the epstein files"},
        {
            "role": "model",
            "text": "I can verify that with sources, and I will summarize what the files actually mention.",
        },
    ]

    prompt = _build_effective_web_search_prompt(request, conversation_history=history)

    assert prompt is not None
    assert "Recent user context to anchor follow-up search:" in prompt
    assert "epstein files" in prompt.lower()
    assert "Recent assistant context to anchor follow-up search:" not in prompt
    assert "Low-information search turn detected." in prompt
