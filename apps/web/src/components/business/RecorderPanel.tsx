import MicIcon from "@mui/icons-material/Mic";
import StopIcon from "@mui/icons-material/Stop";
import { Alert, Button, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { RecordedAudio } from "../../features/learning/hooks/useRecorder";
import { useRecorder } from "../../features/learning/hooks/useRecorder";

interface RecorderPanelProps {
  disabled?: boolean;
  referenceDurationSeconds: number | undefined;
  onRecorded: (audio: RecordedAudio | null) => void;
}

export function RecorderPanel({ disabled = false, onRecorded, referenceDurationSeconds }: RecorderPanelProps): JSX.Element {
  const { t } = useTranslation(["errors", "learning"]);
  const recorder = useRecorder();
  const [durationError, setDurationError] = useState<string | null>(null);

  async function handleStop(): Promise<void> {
    await recorder.stop();
    setDurationError(null);
  }

  function handleUseRecording(): void {
    if (!recorder.audio) {
      onRecorded(null);
      return;
    }
    if (recorder.audio.durationSeconds < 1) {
      setDurationError(t("recordingTooShort", { ns: "errors" }));
      onRecorded(null);
      return;
    }
    if (referenceDurationSeconds && recorder.audio.durationSeconds > referenceDurationSeconds * 3) {
      setDurationError(t("recordingTooLong", { ns: "errors" }));
      onRecorded(null);
      return;
    }
    setDurationError(null);
    onRecorded(recorder.audio);
  }

  return (
    <Stack spacing={1.5} data-testid="recorder-panel">
      {recorder.error ? <Alert severity="warning">{t("recordingBlocked", { ns: "errors" })}</Alert> : null}
      {durationError ? <Alert severity="warning">{durationError}</Alert> : null}
      {recorder.audio ? (
        <Stack spacing={1}>
          <Typography variant="subtitle2">{t("recorder.mine", { ns: "learning" })}</Typography>
          <audio controls src={recorder.audio.url} />
        </Stack>
      ) : null}
      <Stack direction="row" spacing={1}>
        {recorder.state === "recording" ? (
          <Button startIcon={<StopIcon />} color="error" fullWidth variant="contained" onClick={handleStop}>
            {t("recorder.stop", { ns: "learning" })}
          </Button>
        ) : (
          <Button startIcon={<MicIcon />} disabled={disabled} fullWidth variant="contained" onClick={() => void recorder.start()}>
            {t("recorder.start", { ns: "learning" })}
          </Button>
        )}
        {recorder.audio ? (
          <Button
            type="button"
            variant="outlined"
            onClick={() => {
              recorder.reset();
              onRecorded(null);
            }}
          >
            {t("recorder.recordAgain", { ns: "learning" })}
          </Button>
        ) : null}
      </Stack>
      {recorder.audio ? (
        <Button type="button" variant="outlined" onClick={handleUseRecording}>
          {t("recorder.submit", { ns: "learning" })}
        </Button>
      ) : null}
    </Stack>
  );
}
