# backend/app/main.py

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uuid
import os
from dotenv import load_dotenv
load_dotenv()


from .schemas import (
    TranscribeResponse,
    ExtractRequest,
    ExtractionResponse,
    ClarifyRequest,
    SubmitRequest,
    SubmitResponse,
    DraftIdea,
    FieldMeta,
)
from .stt import WhisperSTT
from .rules import validate_draft
from .llm import extract_idea_structured, clarify_idea_structured

app = FastAPI(
    title="AI Voice Idea Submission API",
    version="0.5.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------
# STT (Whisper)
# ----------------------------
stt = WhisperSTT(
    model_size="small",
    device="cpu",
    compute_type="int8",
)

# ----------------------------
# Health check (OpenRouter)
# ----------------------------
@app.get("/health")
def health():
    return {
        "ok": True,
        "mode": "llm" if os.getenv("OPENROUTER_API_KEY") else "llm-disabled",
        "llm_provider": "openrouter",
        "model": os.getenv("OPENROUTER_MODEL", "openai/gpt-5-mini"),
        "stt": "faster-whisper",
    }

# ----------------------------
# Voice → Text (Whisper STT)
# ----------------------------
@app.post("/v1/voice/transcribe", response_model=TranscribeResponse)
async def transcribe(file: UploadFile = File(...)):
    audio_bytes = await file.read()

    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file")

    result = stt.transcribe_bytes(
        audio_bytes,
        original_filename=file.filename or "audio",
    )

    dialect_hint = "arabic" if result.language == "ar" else None

    return TranscribeResponse(
        transcript=result.transcript,
        language=result.language,
        dialect_hint=dialect_hint,
    )

# ----------------------------
# Text → Structured Idea (LLM extraction via OpenRouter)
# ----------------------------
@app.post("/v1/voice/extract", response_model=ExtractionResponse)
async def extract(req: ExtractRequest):
    if not os.getenv("OPENROUTER_API_KEY"):
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY not set")

    # 1) LLM structured extraction
    llm_out = extract_idea_structured(
        transcript=req.text,
        language_hint=req.language_hint,
        dialect_hint=req.dialect_hint,
    )

    # 2) Convert to DraftIdea
    draft = DraftIdea(**llm_out["draft"])

    # 3) Deterministic backend validation (compliance)
    missing_fields, questions = validate_draft(draft)

    # 4) Normalize field_meta
    field_meta = {}
    for k, v in (llm_out.get("field_meta") or {}).items():
        try:
            field_meta[k] = FieldMeta(**v)
        except Exception:
            field_meta[k] = FieldMeta(status="guessed", confidence=0.5)

    return ExtractionResponse(
        draft=draft,
        field_meta=field_meta,
        missing_fields=missing_fields,
        questions=questions,
    )

# ----------------------------
# Clarification → Patch Draft (LLM via OpenRouter)
# ----------------------------
@app.post("/v1/voice/clarify", response_model=ExtractionResponse)
async def clarify(req: ClarifyRequest):
    if not os.getenv("OPENROUTER_API_KEY"):
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY not set")

    # 1) LLM clarification
    llm_out = clarify_idea_structured(
        draft=req.draft,
        answers_text=req.answers_text,
        questions=req.questions,
    )

    draft = DraftIdea(**llm_out["draft"])

    # 2) Re-run backend validation
    missing_fields, questions = validate_draft(draft)

    field_meta = {}
    for k, v in (llm_out.get("field_meta") or {}).items():
        try:
            field_meta[k] = FieldMeta(**v)
        except Exception:
            field_meta[k] = FieldMeta(status="guessed", confidence=0.5)

    return ExtractionResponse(
        draft=draft,
        field_meta=field_meta,
        missing_fields=missing_fields,
        questions=questions,
    )

# ----------------------------
# Final Submit (hard guardrail)
# ----------------------------
@app.post("/v1/ideas", response_model=SubmitResponse)
async def submit(req: SubmitRequest):
    missing_fields, questions = validate_draft(req.draft)

    if missing_fields:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "Incomplete submission",
                "missing_fields": missing_fields,
                "questions": questions,
            },
        )

    idea_id = str(uuid.uuid4())

    # In production:
    # - persist idea
    # - attach transcript + audit trail
    # - notify evaluators

    return SubmitResponse(id=idea_id)
