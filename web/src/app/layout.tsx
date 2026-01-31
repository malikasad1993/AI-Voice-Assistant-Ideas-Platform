import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Voice-first Idea Submission (POC)",
  description: "Arabic (Emirati + other dialects) & English • Auto extraction • Completeness • Clarification",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* Background aura */}
        <div className="fixed inset-0 -z-10">
          <div className="absolute -top-24 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-purple-500/25 via-cyan-500/20 to-emerald-400/20 blur-3xl" />
          <div className="absolute -bottom-24 right-[-120px] h-[520px] w-[520px] rounded-full bg-gradient-to-tr from-pink-500/15 via-amber-500/10 to-blue-500/15 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(255,255,255,0.9),rgba(255,255,255,0))]" />
          <div className="dark:absolute dark:inset-0 dark:bg-[radial-gradient(circle_at_50%_-20%,rgba(255,255,255,0.08),rgba(0,0,0,0))]" />
        </div>

        {children}
      </body>
    </html>
  );
}
