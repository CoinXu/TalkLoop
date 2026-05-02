import { useRef, useState } from "react";

export interface RecordedAudio {
  blob: Blob;
  base64: string;
  durationSeconds: number;
  mimeType: string;
  url: string;
}

type RecorderState = "idle" | "recording" | "recorded" | "blocked";

export function useRecorder(): {
  audio: RecordedAudio | null;
  error: Error | null;
  reset: () => void;
  start: () => Promise<void>;
  state: RecorderState;
  stop: () => Promise<void>;
} {
  const [state, setState] = useState<RecorderState>("idle");
  const [audio, setAudio] = useState<RecordedAudio | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);

  async function start(): Promise<void> {
    setError(null);
    setAudio(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      streamRef.current = stream;
      startTimeRef.current = Date.now();
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setState("recording");
    } catch (caught) {
      const nextError = caught instanceof Error ? caught : new Error("recordingBlocked");
      setError(nextError);
      setState("blocked");
    }
  }

  async function stop(): Promise<void> {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      return;
    }

    const recorded = await new Promise<RecordedAudio>((resolve) => {
      recorder.onstop = async () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const base64 = await blobToBase64(blob);
        resolve({
          blob,
          base64,
          durationSeconds: Math.max(0, (Date.now() - startTimeRef.current) / 1000),
          mimeType,
          url: URL.createObjectURL(blob),
        });
      };
      recorder.stop();
    });

    streamRef.current?.getTracks().forEach((track) => track.stop());
    mediaRecorderRef.current = null;
    streamRef.current = null;
    setAudio(recorded);
    setState("recorded");
  }

  function reset(): void {
    if (audio) {
      URL.revokeObjectURL(audio.url);
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    mediaRecorderRef.current = null;
    streamRef.current = null;
    setAudio(null);
    setError(null);
    setState("idle");
  }

  return { audio, error, reset, start, state, stop };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("invalidRecording"));
        return;
      }
      resolve(result.split(",")[1] ?? "");
    };
    reader.readAsDataURL(blob);
  });
}
