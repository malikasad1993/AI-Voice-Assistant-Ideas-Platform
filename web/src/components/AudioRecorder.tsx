"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  onRecordedFile: (file: File) => void;
};

function pickMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  for (const c of candidates) {
    // @ts-expect-error
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(c)) return c;
  }
  return "";
}

export default function AudioRecorder({ onRecordedFile }: Props) {
  const [supported, setSupported] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);

  const mimeType = useMemo(() => pickMimeType(), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // @ts-expect-error
    if (!window.MediaRecorder) setSupported(false);
  }, []);

  function startTimer() {
    stopTimer();
    timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
  }

  function stopTimer() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function start() {
    setPermissionError(null);
    setAudioUrl(null);
    setSeconds(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      chunksRef.current = [];
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = rec;

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        const ext = (rec.mimeType || "audio/webm").includes("ogg") ? "ogg" : "webm";
        const file = new File([blob], `recording.${ext}`, { type: rec.mimeType || "audio/webm" });
        onRecordedFile(file);

        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      rec.start();
      setIsRecording(true);
      startTimer();
    } catch (err: any) {
      setPermissionError(err?.message || "Microphone permission denied.");
    }
  }

  function stop() {
    stopTimer();
    setIsRecording(false);
    recorderRef.current?.stop();
    recorderRef.current = null;
  }

  return (
    <div className="card glass rounded-2xl p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-extrabold tracking-tight">Live voice recording</div>
          <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
            Record your idea freely in Arabic (Emirati + other dialects) or English.
          </div>
        </div>

        {!supported ? (
          <span className="text-sm text-red-600">Recording not supported in this browser.</span>
        ) : (
          <button
            onClick={isRecording ? stop : start}
            className={`btn ${isRecording ? "bg-red-600 text-white hover:bg-red-500" : "btn-primary"}`}
          >
            <span>{isRecording ? "⏹️" : "⏺️"}</span>
            {isRecording ? "Stop" : "Start"}
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="badge bg-neutral-100 text-neutral-800 dark:bg-white/10 dark:text-white">
          {isRecording ? "Recording…" : "Idle"}
        </span>
        <span className="text-neutral-700 dark:text-neutral-300">⏱️ {seconds}s</span>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          Tip: Speak naturally — long pauses are okay.
        </span>
      </div>

      {permissionError && (
        <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {permissionError}
        </div>
      )}

      {audioUrl && (
        <div className="mt-3">
          <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            Preview recording
          </div>
          <audio controls src={audioUrl} className="mt-2 w-full" />
        </div>
      )}
    </div>
  );
}
