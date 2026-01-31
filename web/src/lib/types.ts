export type InputMode = "record" | "upload" | "text";

export type TranscribeResponse = {
  transcript: string;
  language: "ar" | "en" | "mixed" | "unknown";
  dialect_hint?: string; // e.g., "emirati", "gulf", "msa", "levantine"
};

export type DraftIdea = {
  title: string;
  summary: string;
  problem: string;
  proposed_solution: string;
  target_audience: string;
  expected_impact: string;
  category?: string;
  priority?: "low" | "medium" | "high";
  keywords?: string[];
};

export type FieldStatus = "confirmed" | "guessed" | "missing";

export type FieldMeta = {
  status: FieldStatus;
  confidence: number; // 0..1
};

export type ExtractionResponse = {
  draft: DraftIdea;
  field_meta: Partial<Record<keyof DraftIdea, FieldMeta>>;
  missing_fields: (keyof DraftIdea)[];
  questions: string[]; // clarification questions
};

export type ClarifyResponse = {
  draft: DraftIdea;
  field_meta: Partial<Record<keyof DraftIdea, FieldMeta>>;
  missing_fields: (keyof DraftIdea)[];
  questions: string[];
};

export type SubmitResponse = {
  id: string;
  status: "submitted";
};
