import type {
  TranscribeResponse,
  ExtractionResponse,
  ClarifyResponse,
  SubmitResponse,
  DraftIdea,
} from "./types";

const BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:8000";

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

export async function transcribeAudio(file: File): Promise<TranscribeResponse> {
  const form = new FormData();
  form.append("file", file);

  return http<TranscribeResponse>("/v1/voice/transcribe", {
    method: "POST",
    body: form,
  });
}

export async function extractIdea(params: {
  text: string;
  language_hint?: string;
  dialect_hint?: string;
}): Promise<ExtractionResponse> {
  return http<ExtractionResponse>("/v1/voice/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

export async function clarifyIdea(params: {
  draft: DraftIdea;
  answers_text: string;
  questions: string[];
}): Promise<ClarifyResponse> {
  return http<ClarifyResponse>("/v1/voice/clarify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

export async function submitIdea(params: {
  transcript?: string;
  language?: string;
  dialect_hint?: string;
  draft: DraftIdea;
}): Promise<SubmitResponse> {
  return http<SubmitResponse>("/v1/ideas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}
