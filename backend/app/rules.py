from typing import List, Tuple
from .schemas import DraftIdea

REQUIRED_FIELDS = [
    "title",
    "summary",
    "problem",
    "proposed_solution",
    "target_audience",
    "expected_impact",
]

def validate_draft(draft: DraftIdea) -> Tuple[List[str], List[str]]:
    """
    Returns:
      missing_fields: list[str]
      questions: list[str]
    """
    missing = []

    def empty(s: str) -> bool:
        return not (s or "").strip()

    if empty(draft.title):
        missing.append("title")
    if empty(draft.summary):
        missing.append("summary")
    if empty(draft.problem):
        missing.append("problem")
    if empty(draft.proposed_solution):
        missing.append("proposed_solution")
    if empty(draft.target_audience):
        missing.append("target_audience")
    if empty(draft.expected_impact):
        missing.append("expected_impact")

    questions = []
    for f in missing:
        if f == "title":
            questions.append("What would be a short, clear title for this idea?")
        elif f == "summary":
            questions.append("Can you summarize the idea in 4–6 lines for evaluators?")
        elif f == "problem":
            questions.append("What problem does this idea solve? Please describe it clearly.")
        elif f == "proposed_solution":
            questions.append("What is the proposed solution? Describe the approach at a high level.")
        elif f == "target_audience":
            questions.append("Who is the target audience or stakeholders for this idea?")
        elif f == "expected_impact":
            questions.append("What is the expected impact/benefit (time saved, cost, satisfaction, compliance)?")

    return missing, questions
