from pydantic import BaseModel, Field
from typing import Literal, Optional, List, Dict

Language = Literal["ar", "en", "mixed", "unknown"]
Priority = Literal["low", "medium", "high"]
FieldStatus = Literal["confirmed", "guessed", "missing"]

class TranscribeResponse(BaseModel):
    transcript: str
    language: Language
    dialect_hint: Optional[str] = None

class DraftIdea(BaseModel):
    title: str = ""
    summary: str = ""
    problem: str = ""
    proposed_solution: str = ""
    target_audience: str = ""
    expected_impact: str = ""
    category: Optional[str] = None
    priority: Optional[Priority] = None
    keywords: Optional[List[str]] = None

class FieldMeta(BaseModel):
    status: FieldStatus
    confidence: float = Field(ge=0.0, le=1.0)

class ExtractionResponse(BaseModel):
    draft: DraftIdea
    field_meta: Dict[str, FieldMeta] = {}
    missing_fields: List[str] = []
    questions: List[str] = []

class ExtractRequest(BaseModel):
    text: str
    language_hint: Optional[str] = None
    dialect_hint: Optional[str] = None

class ClarifyRequest(BaseModel):
    draft: DraftIdea
    answers_text: str
    questions: List[str] = []

class SubmitRequest(BaseModel):
    transcript: Optional[str] = None
    language: Optional[str] = None
    dialect_hint: Optional[str] = None
    draft: DraftIdea

class SubmitResponse(BaseModel):
    id: str
    status: Literal["submitted"] = "submitted"
