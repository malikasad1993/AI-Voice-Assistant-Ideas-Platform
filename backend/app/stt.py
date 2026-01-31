# backend/app/stt.py
import os
import tempfile
import subprocess
import shutil
from dataclasses import dataclass
from typing import Optional

from faster_whisper import WhisperModel


@dataclass
class STTResult:
    transcript: str
    language: str  # "ar" | "en" | "mixed" | "unknown"
    language_prob: float


def _map_lang(code: Optional[str]) -> str:
    if not code:
        return "unknown"
    code = code.lower().strip()
    if code.startswith("ar"):
        return "ar"
    if code.startswith("en"):
        return "en"
    return "unknown"


def _ensure_ffmpeg() -> str:
    """
    Windows-safe ffmpeg resolver:
    - Prefer the exact winget install path (bulletproof with uvicorn reload/subprocess)
    - Fall back to PATH lookup
    """
    hardcoded = (
        r"C:\Users\Malik Asad\AppData\Local\Microsoft\WinGet\Packages"
        r"\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe"
        r"\ffmpeg-8.0.1-full_build\bin\ffmpeg.exe"
    )
    if os.path.exists(hardcoded):
        return hardcoded

    ffmpeg_path = shutil.which("ffmpeg") or shutil.which("ffmpeg.exe")
    if ffmpeg_path:
        return ffmpeg_path

    raise RuntimeError(
        "ffmpeg was not found.\n\n"
        "Fix:\n"
        "  - Verify: ffmpeg -version\n"
        "  - Ensure ffmpeg is in PATH OR update the hardcoded path in backend/app/stt.py\n"
    )


def _run_ffmpeg_to_wav(input_path: str, output_path: str) -> None:
    """
    Convert any audio to 16kHz mono WAV for best Whisper performance.
    """
    ffmpeg = _ensure_ffmpeg()

    cmd = [
        ffmpeg,
        "-y",
        "-i", input_path,
        "-ac", "1",
        "-ar", "16000",
        "-vn",
        output_path,
    ]

    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if proc.returncode != 0:
        raise RuntimeError(
            "ffmpeg failed to convert audio.\n"
            "This can happen when the uploaded file type needs codecs not available.\n\n"
            f"ffmpeg error (tail):\n{proc.stderr[-1200:]}"
        )


class WhisperSTT:
    """
    Lazy-loaded Whisper model (shared singleton).
    """
    _model: Optional[WhisperModel] = None

    def __init__(
        self,
        model_size: str = "small",
        device: str = "cpu",
        compute_type: str = "int8",
    ):
        self.model_size = model_size
        self.device = device
        self.compute_type = compute_type

    def _get_model(self) -> WhisperModel:
        if WhisperSTT._model is None:
            WhisperSTT._model = WhisperModel(
                self.model_size,
                device=self.device,
                compute_type=self.compute_type,
            )
        return WhisperSTT._model

    def transcribe_bytes(self, audio_bytes: bytes, original_filename: str = "audio") -> STTResult:
        """
        Save bytes -> normalize to wav (ffmpeg) -> transcribe (faster-whisper) -> return result.
        """
        model = self._get_model()

        with tempfile.TemporaryDirectory() as td:
            safe_name = (original_filename or "audio").replace("\\", "_").replace("/", "_")
            in_path = os.path.join(td, safe_name)
            wav_path = os.path.join(td, "audio_16k_mono.wav")

            with open(in_path, "wb") as f:
                f.write(audio_bytes)

            _run_ffmpeg_to_wav(in_path, wav_path)

            segments, info = model.transcribe(
                wav_path,
                vad_filter=True,
                beam_size=5,
                temperature=0.0,
                condition_on_previous_text=True,
            )

            parts = []
            for seg in segments:
                if seg.text:
                    parts.append(seg.text.strip())

            text = " ".join(parts).strip()

            lang = _map_lang(getattr(info, "language", None))
            lang_prob = float(getattr(info, "language_probability", 0.0) or 0.0)

            return STTResult(transcript=text, language=lang, language_prob=lang_prob)
