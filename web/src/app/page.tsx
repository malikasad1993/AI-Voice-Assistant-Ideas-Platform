"use client";

import React, { useMemo, useState } from "react";
import type { InputMode, ExtractionResponse, TranscribeResponse } from "@/lib/types";
import { extractIdea, transcribeAudio } from "@/lib/api";
import AudioRecorder from "@/components/AudioRecorder";
import IdeaForm from "@/components/IdeaForm";
import ThemeToggle from "@/components/ThemeToggle";
import ModeSelector from "@/components/ModeSelector";

export default function Page() {
  const [mode, setMode] = useState<InputMode>("record");

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [manualText, setManualText] = useState("");

  const [transcribe, setTranscribe] = useState<TranscribeResponse | null>(null);
  const [extraction, setExtraction] = useState<ExtractionResponse | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transcriptText = useMemo(() => {
    if (mode === "text") return manualText.trim();
    return transcribe?.transcript?.trim() || "";
  }, [mode, manualText, transcribe]);

  async function runProcess() {
    setError(null);
    setExtraction(null);

    try {
      setBusy(true);

      let transcript = "";
      let language: string | undefined;
      let dialect_hint: string | undefined;

      if (mode === "text") {
        if (!manualText.trim()) throw new Error("Please paste/type your idea text first.");
        transcript = manualText.trim();
        language = "unknown";
      } else {
        if (!audioFile) throw new Error("Please record or upload an audio file first.");
        const t = await transcribeAudio(audioFile);
        setTranscribe(t);
        transcript = t.transcript;
        language = t.language;
        dialect_hint = t.dialect_hint;
      }

      if (!transcript.trim()) throw new Error("Transcript is empty.");

      const ex = await extractIdea({
        text: transcript,
        language_hint: language,
        dialect_hint,
      });
      setExtraction(ex);
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container-app py-8">
      {/* Top bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-950">
            💡
          </div>
          <div>
            <div className="text-xl font-extrabold tracking-tight">
              Voice-first Idea Submission
            </div>
            <div className="text-xs text-neutral-600 dark:text-neutral-300">
              Arabic (Emirati + other dialects) & English • Structured extraction • Completeness • Clarification
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            className="btn btn-ghost"
            href="#form"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("form")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            📄 Go to Form
          </a>
          <ThemeToggle />
        </div>
      </div>

      {/* Mode cards */}
      <ModeSelector mode={mode} setMode={(m) => {
        setMode(m);
        setAudioFile(null);
        setTranscribe(null);
        setExtraction(null);
        setError(null);
      }} />

      {/* Input + Transcript */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Left: Input */}
        <div className="grid gap-4">
          {mode === "record" && (
            <AudioRecorder
              onRecordedFile={(f) => {
                setAudioFile(f);
                setTranscribe(null);
                setExtraction(null);
                setError(null);
              }}
            />
          )}

          {mode === "upload" && (
            <div className="card glass rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-extrabold tracking-tight">Upload audio file</div>
                  <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
                    Upload a voice note (webm/ogg/mp3/wav/m4a). We’ll transcribe and extract.
                  </div>
                </div>
                <span className="badge bg-neutral-100 text-neutral-800 dark:bg-white/10 dark:text-white">
                  📌 Input
                </span>
              </div>

              <div className="mt-4">
                <input
                  type="file"
                  accept="audio/*"
                  className="block w-full text-sm file:mr-4 file:rounded-xl file:border-0 file:bg-neutral-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-neutral-800 dark:file:bg-white dark:file:text-neutral-950 dark:hover:file:bg-neutral-200"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setAudioFile(f);
                    setTranscribe(null);
                    setExtraction(null);
                    setError(null);
                  }}
                />
                {audioFile && (
                  <div className="mt-3 rounded-xl bg-neutral-50 p-3 text-sm text-neutral-700 dark:bg-white/5 dark:text-neutral-200">
                    Selected: <span className="font-semibold">{audioFile.name}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {mode === "text" && (
            <div className="card glass rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-extrabold tracking-tight">Manual text entry</div>
                  <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
                    Paste your idea in Arabic or English. We’ll extract structured fields.
                  </div>
                </div>
                <span className="badge bg-neutral-100 text-neutral-800 dark:bg-white/10 dark:text-white">
                  📝 Input
                </span>
              </div>

              <textarea
                value={manualText}
                onChange={(e) => {
                  setManualText(e.target.value);
                  setTranscribe(null);
                  setExtraction(null);
                  setError(null);
                }}
                className="mt-4 min-h-[220px] w-full rounded-2xl border border-neutral-200 bg-white/60 px-3 py-3 text-sm outline-none focus:border-neutral-900 dark:border-white/10 dark:bg-white/5 dark:focus:border-white/40"
                placeholder="Describe your idea freely..."
              />
            </div>
          )}

          <button onClick={runProcess} disabled={busy} className="btn btn-primary w-full py-3">
            {busy ? "Processing..." : "✨ Process & Auto-fill"}
          </button>

          {error && (
            <div className="card glass rounded-2xl border border-red-500/20 bg-red-50/70 p-4 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-200">
              {error}
            </div>
          )}

          {/* Status pill */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
            <span className="badge bg-white/70 text-neutral-800 dark:bg-white/10 dark:text-white">
              ✅ 3 Input Modes
            </span>
            <span className="badge bg-white/70 text-neutral-800 dark:bg-white/10 dark:text-white">
              🔍 Completeness checks
            </span>
            <span className="badge bg-white/70 text-neutral-800 dark:bg-white/10 dark:text-white">
              💬 Clarification loop
            </span>
          </div>
        </div>

        {/* Right: Transcript */}
        <div className="card glass rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-extrabold tracking-tight">Transcript</div>
              <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
                Voice modes show transcription. Text mode shows your input.
              </div>
            </div>

            {transcribe?.language && (
              <span className="badge bg-neutral-900 text-white dark:bg-white dark:text-neutral-950">
                {transcribe.language}
                {transcribe.dialect_hint ? ` · ${transcribe.dialect_hint}` : ""}
              </span>
            )}
          </div>

          <div className="mt-4 min-h-[320px] whitespace-pre-wrap rounded-2xl border border-neutral-200 bg-white/60 p-4 text-sm text-neutral-900 dark:border-white/10 dark:bg-white/5 dark:text-white">
            {transcriptText || <span className="text-neutral-500 dark:text-neutral-400">Nothing yet.</span>}
          </div>

          <div className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
            Tip: After processing, you’ll get an auto-filled submission form below.
          </div>
        </div>
      </div>

      {/* Form */}
      <div id="form" className="mt-8">
        {extraction ? (
          <IdeaForm
            transcript={transcriptText}
            language={transcribe?.language}
            dialect_hint={transcribe?.dialect_hint}
            extraction={extraction}
          />
        ) : (
          <div className="card glass rounded-2xl border border-dashed border-neutral-300 p-8 text-sm text-neutral-600 dark:border-white/15 dark:text-neutral-300">
            Run <span className="font-semibold">Process & Auto-fill</span> to generate the structured submission form.
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-10 text-center text-xs text-neutral-500 dark:text-neutral-400">
        POC UI — ready for demo. Next: connect backend STT + extraction.
      </div>
    </main>
  );
}
