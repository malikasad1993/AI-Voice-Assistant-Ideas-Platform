"use client";

import React from "react";
import type { InputMode } from "@/lib/types";

export default function ModeSelector({
  mode,
  setMode,
}: {
  mode: InputMode;
  setMode: (m: InputMode) => void;
}) {
  const items: { key: InputMode; title: string; desc: string; icon: string }[] = [
    { key: "record", title: "Live Recording", desc: "Speak freely (Arabic/English).", icon: "🎙️" },
    { key: "upload", title: "Audio Upload", desc: "Upload a voice note or file.", icon: "📁" },
    { key: "text", title: "Manual Text", desc: "Paste or type your idea.", icon: "⌨️" },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {items.map((it) => {
        const active = it.key === mode;
        return (
          <button
            key={it.key}
            onClick={() => setMode(it.key)}
            className={[
              "card glass w-full rounded-2xl p-4 text-left transition",
              active
                ? "ring-2 ring-neutral-900/30 dark:ring-white/30"
                : "hover:translate-y-[-1px] hover:bg-white/70 dark:hover:bg-white/10",
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{it.icon}</span>
                  <div className="text-sm font-extrabold tracking-tight">{it.title}</div>
                </div>
                <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
                  {it.desc}
                </div>
              </div>
              {active && (
                <span className="badge bg-neutral-900 text-white dark:bg-white dark:text-neutral-950">
                  Selected
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
