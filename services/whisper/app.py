from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Literal

import requests
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field, HttpUrl
from faster_whisper import WhisperModel


MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "small")
DEVICE = os.getenv("WHISPER_DEVICE", "auto")
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
MODEL_ROOT = os.getenv("WHISPER_MODEL_ROOT")
DOWNLOAD_TIMEOUT_SECONDS = int(os.getenv("WHISPER_DOWNLOAD_TIMEOUT_SECONDS", "60"))

app = FastAPI(title="BBC Learning English Whisper ASR", version="0.1.0")
model: WhisperModel | None = None


class TranscribeUrlRequest(BaseModel):
  audioUrl: HttpUrl
  language: str | None = Field(default="en")
  wordTimestamps: bool = Field(default=False)
  beamSize: int = Field(default=5, ge=1, le=10)


class WordResponse(BaseModel):
  word: str
  startMs: int
  endMs: int
  probability: float | None = None


class SegmentResponse(BaseModel):
  id: int
  startMs: int
  endMs: int
  text: str
  words: list[WordResponse] = []


class TranscriptionResponse(BaseModel):
  text: str
  language: str | None
  durationSeconds: float | None
  segments: list[SegmentResponse]


def get_model() -> WhisperModel:
  global model
  if model is None:
    kwargs = {
      "device": DEVICE,
      "compute_type": COMPUTE_TYPE,
    }
    if MODEL_ROOT:
      kwargs["download_root"] = MODEL_ROOT
    model = WhisperModel(MODEL_SIZE, **kwargs)
  return model


def seconds_to_ms(value: float | None) -> int:
  if value is None:
    return 0
  return max(0, round(value * 1000))


def transcribe_file(
  audio_path: Path,
  *,
  language: str | None,
  word_timestamps: bool,
  beam_size: int,
) -> TranscriptionResponse:
  segments, info = get_model().transcribe(
    str(audio_path),
    language=language,
    word_timestamps=word_timestamps,
    vad_filter=True,
    beam_size=beam_size,
  )

  response_segments: list[SegmentResponse] = []
  text_parts: list[str] = []
  for index, segment in enumerate(segments):
    text = segment.text.strip()
    if not text:
      continue

    text_parts.append(text)
    words: list[WordResponse] = []
    if segment.words:
      for word in segment.words:
        words.append(
          WordResponse(
            word=word.word.strip(),
            startMs=seconds_to_ms(word.start),
            endMs=seconds_to_ms(word.end),
            probability=word.probability,
          )
        )

    response_segments.append(
      SegmentResponse(
        id=index,
        startMs=seconds_to_ms(segment.start),
        endMs=seconds_to_ms(segment.end),
        text=text,
        words=words,
      )
    )

  return TranscriptionResponse(
    text=" ".join(text_parts),
    language=getattr(info, "language", None),
    durationSeconds=getattr(info, "duration", None),
    segments=response_segments,
  )


def write_upload_to_temp(file: UploadFile) -> Path:
  suffix = Path(file.filename or "audio").suffix or ".audio"
  handle = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
  path = Path(handle.name)
  try:
    with handle:
      while chunk := file.file.read(1024 * 1024):
        handle.write(chunk)
    return path
  except Exception:
    path.unlink(missing_ok=True)
    raise


def download_to_temp(audio_url: str) -> Path:
  suffix = Path(audio_url.split("?", 1)[0]).suffix or ".audio"
  handle = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
  path = Path(handle.name)
  try:
    with requests.get(audio_url, stream=True, timeout=DOWNLOAD_TIMEOUT_SECONDS) as response:
      response.raise_for_status()
      with handle:
        for chunk in response.iter_content(chunk_size=1024 * 1024):
          if chunk:
            handle.write(chunk)
    return path
  except Exception as error:
    path.unlink(missing_ok=True)
    raise HTTPException(status_code=502, detail=f"failed to download audio: {error}") from error


@app.get("/health")
def health() -> dict[str, str]:
  return {"status": "ok", "model": MODEL_SIZE}


@app.post("/transcribe", response_model=TranscriptionResponse)
def transcribe_url(payload: TranscribeUrlRequest) -> TranscriptionResponse:
  audio_path = download_to_temp(str(payload.audioUrl))
  try:
    return transcribe_file(
      audio_path,
      language=payload.language,
      word_timestamps=payload.wordTimestamps,
      beam_size=payload.beamSize,
    )
  finally:
    audio_path.unlink(missing_ok=True)


@app.post("/v1/audio/transcriptions", response_model=TranscriptionResponse)
def openai_style_transcription(
  file: UploadFile = File(...),
  language: str | None = Form(default="en"),
  response_format: Literal["json"] = Form(default="json"),
  timestamp_granularities: list[str] | None = Form(default=None),
) -> TranscriptionResponse:
  if response_format != "json":
    raise HTTPException(status_code=400, detail="only json response_format is supported")

  audio_path = write_upload_to_temp(file)
  try:
    return transcribe_file(
      audio_path,
      language=language,
      word_timestamps="word" in (timestamp_granularities or []),
      beam_size=5,
    )
  finally:
    audio_path.unlink(missing_ok=True)
