# backend/app/llm.py
import os
import json
from typing import Optional, Dict, Any, List

from openai import OpenAI
from .schemas import DraftIdea

# -----------------------------
# OpenRouter client
# -----------------------------
# OpenRouter is OpenAI-compatible. Use base_url + OpenRouter key.
# Docs: https://openrouter.ai/docs
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-5-mini")

OPENROUTER_SITE_URL = os.getenv("OPENROUTER_SITE_URL", "http://localhost")
OPENROUTER_APP_NAME = os.getenv("OPENROUTER_APP_NAME", "AI Voice Ideas Platform")

if not OPENROUTER_API_KEY:
    raise RuntimeError(
        "OPENROUTER_API_KEY is not set. "
        "Set it to your OpenRouter key starting with sk-or-v1-..."
    )

client = OpenAI(
    api_key=OPENROUTER_API_KEY,
    base_url=OPENROUTER_BASE_URL,
)

# -----------------------------
# JSON Schema (STRICT)
# -----------------------------
# OpenRouter supports response_format json_schema for compatible models.
# Keep schema tight: required + additionalProperties=false.
IDEA_DRAFT_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "title",
        "summary",
        "problem",
        "proposed_solution",
        "target_audience",
        "expected_impact",
        "category",
        "priority",
        "keywords",
    ],
    "properties": {
        "title": {"type": "string"},
        "summary": {"type": "string"},
        "problem": {"type": "string"},
        "proposed_solution": {"type": "string"},
        "target_audience": {"type": "string"},
        "expected_impact": {"type": "string"},
        "category": {"type": ["string", "null"]},
        "priority": {"type": ["string", "null"], "enum": ["low", "medium", "high", None]},
        "keywords": {"type": ["array", "null"], "items": {"type": "string"}},
    },
}

FIELD_META_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["status", "confidence"],
    "properties": {
        "status": {"type": "string", "enum": ["confirmed", "guessed", "missing"]},
        "confidence": {"type": "number", "minimum": 0.0, "maximum": 1.0},
    },
}

EXTRACTION_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["draft", "field_meta"],
    "properties": {
        "draft": IDEA_DRAFT_SCHEMA,
        "field_meta": {
            "type": "object",
            "additionalProperties": False,
            "required": [
                "title",
                "summary",
                "problem",
                "proposed_solution",
                "target_audience",
                "expected_impact",
                "category",
                "priority",
                "keywords",
            ],
            "properties": {
                "title": FIELD_META_SCHEMA,
                "summary": FIELD_META_SCHEMA,
                "problem": FIELD_META_SCHEMA,
                "proposed_solution": FIELD_META_SCHEMA,
                "target_audience": FIELD_META_SCHEMA,
                "expected_impact": FIELD_META_SCHEMA,
                "category": FIELD_META_SCHEMA,
                "priority": FIELD_META_SCHEMA,
                "keywords": FIELD_META_SCHEMA,
            },
        },
    },
}


def _parse_json_text(s: str) -> Dict[str, Any]:
    s = (s or "").strip()
    if not s:
        raise RuntimeError("Model returned empty content (expected JSON).")
    try:
        return json.loads(s)
    except Exception as e:
        tail = s[-1600:] if len(s) > 1600 else s
        raise RuntimeError(f"Failed to parse JSON: {e}\n\nTail:\n{tail}")


def _chat_json_schema(messages: List[Dict[str, str]]) -> Dict[str, Any]:
    """
    Calls OpenRouter Chat Completions with structured outputs (json_schema).
    Notes:
      - We DO NOT send temperature because GPT-5 variants may reject it.
      - max_tokens is set to 6000 as requested.
    """
    resp = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        max_tokens=6000,
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "IdeaExtraction",
                "strict": True,
                "schema": EXTRACTION_SCHEMA,
            },
        },
        extra_headers={
            # Optional OpenRouter headers (recommended)
            "HTTP-Referer": OPENROUTER_SITE_URL,
            "X-Title": OPENROUTER_APP_NAME,
        },
    )

    content = resp.choices[0].message.content or ""
    return _parse_json_text(content)


def extract_idea_structured(
    transcript: str,
    language_hint: Optional[str] = None,
    dialect_hint: Optional[str] = None,
) -> Dict[str, Any]:
    system = (
        "You are a government idea-submission extraction engine.\n"
        "Convert free-form speech (Arabic dialects incl. Emirati, or English) into a structured, evaluator-ready idea submission.\n\n"
        "Rules:\n"
        "- Use ONLY information explicitly present in the transcript.\n"
        "- Required fields not stated → empty string + meta.status='missing'.\n"
        "- Light inference → meta.status='guessed' (confidence ≤ 0.7).\n"
        "- Explicit info → meta.status='confirmed' (confidence ≥ 0.85).\n"
        "- Title ≤ 80 characters.\n"
        "- Summary: concise, professional, review-ready.\n"
        "- No filler, no hallucination.\n"
    )

    hint = f"language_hint={language_hint or 'unknown'}; dialect_hint={dialect_hint or 'none'}"
    user = f"Transcript:\n{transcript}\n\nHints: {hint}"

    return _chat_json_schema(
        [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]
    )


def clarify_idea_structured(
    draft: DraftIdea,
    answers_text: str,
    questions: List[str],
) -> Dict[str, Any]:
    system = (
        "You update a structured government idea submission using user clarifications.\n\n"
        "Rules:\n"
        "- Update ONLY fields supported by the user's answers.\n"
        "- Do NOT invent or assume missing information.\n"
        "- Unanswered required fields stay empty + meta.status='missing'.\n"
        "- Strong info → confirmed (≥ 0.85), partial → guessed (≤ 0.7).\n"
    )

    q_block = "\n".join([f"- {q}" for q in (questions or [])]) or "(none)"
    user = (
        "Current draft (JSON):\n"
        f"{draft.model_dump()}\n\n"
        "Questions asked:\n"
        f"{q_block}\n\n"
        "User answers:\n"
        f"{answers_text}\n"
    )

    return _chat_json_schema(
        [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]
    )
