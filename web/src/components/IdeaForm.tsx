"use client";

import React, { useMemo, useState } from "react";
import type { DraftIdea, ExtractionResponse } from "@/lib/types";
import { clarifyIdea, submitIdea } from "@/lib/api";

type Props = {
  transcript: string;
  language?: string;
  dialect_hint?: string;
  extraction: ExtractionResponse;
};

const REQUIRED_FIELDS: (keyof DraftIdea)[] = [
  "title",
  "summary",
  "problem",
  "proposed_solution",
  "target_audience",
  "expected_impact",
];

function labelOf(k: keyof DraftIdea) {
  return k
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusChip(status?: string, confidence?: number) {
  const base = "badge";
  if (!status) return null;

  const confText = typeof confidence === "number" ? ` · ${Math.round(confidence * 100)}%` : "";

  if (status === "missing") {
    return (
      <span className={`${base} bg-red-500/10 text-red-700 dark:text-red-200`}>
        Missing{confText}
      </span>
    );
  }

  if (status === "guessed") {
    return (
      <span className={`${base} bg-amber-500/10 text-amber-800 dark:text-amber-200`}>
        Guessed{confText}
      </span>
    );
  }

  return (
    <span className={`${base} bg-emerald-500/10 text-emerald-800 dark:text-emerald-200`}>
      Confirmed{confText}
    </span>
  );
}

export default function IdeaForm({ transcript, language, dialect_hint, extraction }: Props) {
  const [draft, setDraft] = useState<DraftIdea>(extraction.draft);
  const [questions, setQuestions] = useState<string[]>(extraction.questions || []);
  const [missingFields, setMissingFields] = useState<(keyof DraftIdea)[]>(
    extraction.missing_fields || []
  );
  const [fieldMeta, setFieldMeta] = useState(extraction.field_meta || {});

  const [answersText, setAnswersText] = useState("");
  const [isClarifying, setIsClarifying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const completeness = useMemo(() => {
    const have = REQUIRED_FIELDS.filter((f) => {
      const v = (draft as any)[f];
      return typeof v === "string" ? v.trim().length > 0 : !!v;
    }).length;
    return Math.round((have / REQUIRED_FIELDS.length) * 100);
  }, [draft]);

  const stillMissing = useMemo(() => {
    return REQUIRED_FIELDS.filter((f) => {
      const v = (draft as any)[f];
      return !(typeof v === "string" ? v.trim().length > 0 : !!v);
    });
  }, [draft]);

  function updateField<K extends keyof DraftIdea>(k: K, value: DraftIdea[K]) {
    setDraft((d) => ({ ...d, [k]: value }));
    // Treat user edits as confirmed visually (optional)
    setFieldMeta((m: any) => ({
      ...m,
      [k]: { status: "confirmed", confidence: 1 },
    }));
  }

  function showToast(type: "ok" | "err", text: string) {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 3500);
  }

  async function runClarification() {
    if (!answersText.trim()) {
      showToast("err", "Type your answers first (one message is fine).");
      return;
    }

    setIsClarifying(true);
    try {
      const res = await clarifyIdea({
        draft,
        answers_text: answersText,
        questions,
      });

      setDraft(res.draft);
      setFieldMeta(res.field_meta || {});
      setMissingFields(res.missing_fields || []);
      setQuestions(res.questions || []);
      setAnswersText("");
      showToast("ok", "Updated with your clarification ✅");
    } catch (e: any) {
      showToast("err", e?.message || "Clarification failed.");
    } finally {
      setIsClarifying(false);
    }
  }

  async function runSubmit() {
    if (stillMissing.length > 0) {
      showToast("err", `Missing required fields: ${stillMissing.map(labelOf).join(", ")}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitIdea({
        transcript,
        language,
        dialect_hint,
        draft,
      });
      showToast("ok", `Submitted ✅ (id: ${res.id})`);
    } catch (e: any) {
      showToast("err", e?.message || "Submit failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative">
      {/* Toast */}
      {toast && (
        <div className="pointer-events-none fixed left-1/2 top-6 z-50 w-[92%] max-w-xl -translate-x-1/2">
          <div
            className={[
              "card glass rounded-2xl px-4 py-3 text-sm font-semibold",
              toast.type === "ok"
                ? "border border-emerald-500/20 bg-emerald-50/70 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100"
                : "border border-red-500/20 bg-red-50/70 text-red-900 dark:bg-red-500/10 dark:text-red-100",
            ].join(" ")}
          >
            {toast.text}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left: Form */}
        <div className="card glass rounded-2xl p-5 lg:col-span-2">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-extrabold tracking-tight">Auto-filled submission</div>
              <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
                Review, edit, and submit. Edits are treated as confirmed.
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="badge bg-neutral-900 text-white dark:bg-white dark:text-neutral-950">
                  Completeness: {completeness}%
                </span>
                {stillMissing.length === 0 ? (
                  <span className="badge bg-emerald-500/10 text-emerald-800 dark:text-emerald-200">
                    ✅ Ready to submit
                  </span>
                ) : (
                  <span className="badge bg-amber-500/10 text-amber-800 dark:text-amber-200">
                    ⚠️ Needs info
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={runSubmit} disabled={isSubmitting} className="btn btn-primary">
                {isSubmitting ? "Submitting…" : "Submit"}
                <span aria-hidden>🚀</span>
              </button>
            </div>
          </div>

          {/* Form grid */}
          <div className="mt-5 grid gap-4">
            <FieldRow
              label="Title"
              chip={statusChip(fieldMeta.title?.status, fieldMeta.title?.confidence)}
            >
              <input
                value={draft.title || ""}
                onChange={(e) => updateField("title", e.target.value)}
                className="w-full rounded-2xl border border-neutral-200 bg-white/60 px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-white/10 dark:bg-white/5 dark:focus:border-white/40"
                placeholder="Short, clear title"
              />
            </FieldRow>

            <FieldRow
              label="Summary"
              chip={statusChip(fieldMeta.summary?.status, fieldMeta.summary?.confidence)}
            >
              <textarea
                value={draft.summary || ""}
                onChange={(e) => updateField("summary", e.target.value)}
                className="min-h-[90px] w-full rounded-2xl border border-neutral-200 bg-white/60 px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-white/10 dark:bg-white/5 dark:focus:border-white/40"
                placeholder="1 paragraph summary"
              />
              <HelperText text="Tip: Keep this to ~4–6 lines for evaluators." />
            </FieldRow>

            <FieldRow
              label="Problem"
              chip={statusChip(fieldMeta.problem?.status, fieldMeta.problem?.confidence)}
            >
              <textarea
                value={draft.problem || ""}
                onChange={(e) => updateField("problem", e.target.value)}
                className="min-h-[120px] w-full rounded-2xl border border-neutral-200 bg-white/60 px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-white/10 dark:bg-white/5 dark:focus:border-white/40"
                placeholder="What problem are you solving?"
              />
            </FieldRow>

            <FieldRow
              label="Proposed solution"
              chip={statusChip(fieldMeta.proposed_solution?.status, fieldMeta.proposed_solution?.confidence)}
            >
              <textarea
                value={draft.proposed_solution || ""}
                onChange={(e) => updateField("proposed_solution", e.target.value)}
                className="min-h-[120px] w-full rounded-2xl border border-neutral-200 bg-white/60 px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-white/10 dark:bg-white/5 dark:focus:border-white/40"
                placeholder="Describe the proposed solution"
              />
            </FieldRow>

            <div className="grid gap-4 md:grid-cols-2">
              <FieldRow
                label="Target audience / stakeholders"
                chip={statusChip(fieldMeta.target_audience?.status, fieldMeta.target_audience?.confidence)}
              >
                <input
                  value={draft.target_audience || ""}
                  onChange={(e) => updateField("target_audience", e.target.value)}
                  className="w-full rounded-2xl border border-neutral-200 bg-white/60 px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-white/10 dark:bg-white/5 dark:focus:border-white/40"
                  placeholder="Who benefits? Who uses it?"
                />
              </FieldRow>

              <FieldRow
                label="Expected impact / benefits"
                chip={statusChip(fieldMeta.expected_impact?.status, fieldMeta.expected_impact?.confidence)}
              >
                <textarea
                  value={draft.expected_impact || ""}
                  onChange={(e) => updateField("expected_impact", e.target.value)}
                  className="min-h-[90px] w-full rounded-2xl border border-neutral-200 bg-white/60 px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-white/10 dark:bg-white/5 dark:focus:border-white/40"
                  placeholder="Time saved, cost, satisfaction, compliance, etc."
                />
              </FieldRow>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FieldRow
                label="Category (optional)"
                chip={statusChip(fieldMeta.category?.status, fieldMeta.category?.confidence)}
              >
                <input
                  value={draft.category || ""}
                  onChange={(e) => updateField("category", e.target.value)}
                  className="w-full rounded-2xl border border-neutral-200 bg-white/60 px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-white/10 dark:bg-white/5 dark:focus:border-white/40"
                  placeholder="e.g., Service Delivery, IT, Operations"
                />
              </FieldRow>

              <FieldRow
                label="Priority (optional)"
                chip={statusChip(fieldMeta.priority?.status, fieldMeta.priority?.confidence)}
              >
                <select
                  value={draft.priority || ""}
                  onChange={(e) => updateField("priority", (e.target.value || undefined) as any)}
                  className="w-full rounded-2xl border border-neutral-200 bg-white/60 px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-white/10 dark:bg-white/5 dark:focus:border-white/40"
                >
                  <option value="">(not set)</option>
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
              </FieldRow>
            </div>

            {/* Footer actions */}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-neutral-600 dark:text-neutral-300">
                {stillMissing.length === 0 ? (
                  <span className="font-semibold text-emerald-700 dark:text-emerald-200">
                    ✅ All required fields are complete.
                  </span>
                ) : (
                  <span className="font-semibold text-amber-800 dark:text-amber-200">
                    ⚠️ Missing: {stillMissing.map(labelOf).join(", ")}
                  </span>
                )}
              </div>

              <button onClick={runSubmit} disabled={isSubmitting} className="btn btn-primary">
                {isSubmitting ? "Submitting…" : "Submit idea"}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Completeness + Clarification */}
        <div className="card glass rounded-2xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-extrabold tracking-tight">Completeness & Clarification</div>
              <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
                If anything is missing, answer questions — we’ll patch the draft.
              </div>
            </div>
            <span className="badge bg-neutral-100 text-neutral-800 dark:bg-white/10 dark:text-white">
              💬
            </span>
          </div>

          {/* Missing fields chips */}
          <div className="mt-4">
            <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">
              Missing fields
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(missingFields || []).length === 0 ? (
                <span className="badge bg-emerald-500/10 text-emerald-800 dark:text-emerald-200">
                  ✅ Nothing missing
                </span>
              ) : (
                missingFields.map((f) => (
                  <span
                    key={String(f)}
                    className="badge bg-amber-500/10 text-amber-800 dark:text-amber-200"
                  >
                    {labelOf(f)}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Questions */}
          <div className="mt-4">
            <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">
              Questions
            </div>

            {(questions || []).length === 0 ? (
              <div className="mt-2 rounded-2xl border border-neutral-200 bg-white/60 p-3 text-sm text-neutral-600 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300">
                No questions right now. You can still polish the form on the left.
              </div>
            ) : (
              <div className="mt-2 grid gap-2">
                {questions.map((q, i) => (
                  <div
                    key={`${i}-${q}`}
                    className="rounded-2xl border border-neutral-200 bg-white/60 p-3 text-sm text-neutral-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
                  >
                    <div className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                      Question {i + 1}
                    </div>
                    <div className="mt-1">{q}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Answer box */}
          <div className="mt-4">
            <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">
              Your answers
            </div>
            <textarea
              value={answersText}
              onChange={(e) => setAnswersText(e.target.value)}
              className="mt-2 min-h-[140px] w-full rounded-2xl border border-neutral-200 bg-white/60 px-3 py-3 text-sm outline-none focus:border-neutral-900 dark:border-white/10 dark:bg-white/5 dark:focus:border-white/40"
              placeholder="Answer the questions above (one message is fine)."
            />

            <button
              onClick={runClarification}
              disabled={isClarifying}
              className="btn btn-primary mt-3 w-full py-3"
            >
              {isClarifying ? "Updating…" : "Apply clarification"}
              <span aria-hidden>✨</span>
            </button>

            <div className="mt-3 rounded-2xl border border-neutral-200 bg-white/60 p-3 text-xs text-neutral-700 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300">
              <div className="font-semibold">Tip</div>
              You can also skip clarification and directly edit any field on the left.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldRow({
  label,
  chip,
  children,
}: {
  label: string;
  chip?: React.ReactNode | null;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">
          {label}
        </label>
        {chip}
      </div>
      {children}
    </div>
  );
}

function HelperText({ text }: { text: string }) {
  return <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{text}</div>;
}
