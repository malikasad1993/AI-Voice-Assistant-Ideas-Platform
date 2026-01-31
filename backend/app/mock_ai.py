from .schemas import DraftIdea, FieldMeta
from .rules import validate_draft

def naive_language_detect(text: str) -> str:
    # super simple heuristic for POC
    arabic_chars = sum(1 for c in text if "\u0600" <= c <= "\u06FF")
    latin_chars = sum(1 for c in text if "A" <= c <= "z")
    if arabic_chars > 0 and latin_chars > 0:
        return "mixed"
    if arabic_chars > 0:
        return "ar"
    if latin_chars > 0:
        return "en"
    return "unknown"

def mock_extract(text: str) -> tuple[DraftIdea, dict, list[str], list[str]]:
    """
    Pretend we extracted structured data.
    We'll fill what we can from the text; everything else will be missing.
    """
    draft = DraftIdea()

    # tiny heuristics to fill some fields
    t = text.strip()
    if len(t) > 0:
        draft.summary = t[:350].strip()
        draft.problem = t[:500].strip()

    # Guess a title from first sentence
    first_line = t.split("\n")[0].strip()
    if first_line:
        draft.title = first_line[:80]

    # meta
    field_meta = {
        "title": FieldMeta(status="guessed" if draft.title else "missing", confidence=0.6 if draft.title else 0.0),
        "summary": FieldMeta(status="guessed" if draft.summary else "missing", confidence=0.55 if draft.summary else 0.0),
        "problem": FieldMeta(status="guessed" if draft.problem else "missing", confidence=0.55 if draft.problem else 0.0),
        "proposed_solution": FieldMeta(status="missing", confidence=0.0),
        "target_audience": FieldMeta(status="missing", confidence=0.0),
        "expected_impact": FieldMeta(status="missing", confidence=0.0),
    }

    missing_fields, questions = validate_draft(draft)
    return draft, field_meta, missing_fields, questions

def mock_clarify(draft: DraftIdea, answers_text: str, questions: list[str]):
    """
    Very naive patching:
      - If the answers mention 'audience' or 'stakeholders', fill target_audience.
      - If the answers mention 'impact/benefit', fill expected_impact.
      - Otherwise, put answers into proposed_solution if it's missing.
    """
    ans = answers_text.strip()
    if not ans:
        missing_fields, qs = validate_draft(draft)
        return draft, {}, missing_fields, qs

    lower = ans.lower()

    # Patch fields based on keywords
    if not (draft.target_audience or "").strip() and ("audience" in lower or "stakeholder" in lower or "users" in lower):
        draft.target_audience = ans[:250]

    if not (draft.expected_impact or "").strip() and ("impact" in lower or "benefit" in lower or "save" in lower or "cost" in lower):
        draft.expected_impact = ans[:350]

    if not (draft.proposed_solution or "").strip():
        draft.proposed_solution = ans[:800]

    # Any user message can also improve summary if summary is empty
    if not (draft.summary or "").strip():
        draft.summary = ans[:350]

    # Meta recalculation (simple)
    field_meta = {}
    for k in ["title", "summary", "problem", "proposed_solution", "target_audience", "expected_impact"]:
        v = getattr(draft, k)
        field_meta[k] = FieldMeta(
            status="confirmed" if (v or "").strip() else "missing",
            confidence=1.0 if (v or "").strip() else 0.0
        )

    missing_fields, qs = validate_draft(draft)
    return draft, field_meta, missing_fields, qs
