import PauseCircleFilledIcon from "@mui/icons-material/PauseCircleFilled";
import PlayCircleFilledIcon from "@mui/icons-material/PlayCircleFilled";
import ReplayIcon from "@mui/icons-material/Replay";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import { Alert, Box, IconButton, Slider, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SyncedSegment, TranscriptSegment } from "../../types";

interface AudioTranscriptProps {
  audioUrl: string | undefined;
  synced: SyncedSegment[];
  segments: TranscriptSegment[];
  showTranscript: boolean;
  onAudioReady?: (durationSeconds: number) => void;
  onAudioError?: () => void;
}

export function AudioTranscript({
  audioUrl,
  onAudioError,
  onAudioReady,
  segments,
  showTranscript,
  synced,
}: AudioTranscriptProps): JSX.Element {
  const { t } = useTranslation(["errors", "learning"]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const segmentRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [currentTime, setCurrentTime] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const displaySegments = synced.length > 0 ? synced : segments;

  const activeSegmentId = useMemo(
    () => getSegmentId(synced.find((segment) => currentTime >= getStartSeconds(segment) && currentTime <= getEndSeconds(segment))),
    [currentTime, synced],
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return undefined;
    }

    const handleTimeUpdate = (): void => setCurrentTime(audio.currentTime);
    const handleLoaded = (): void => {
      setDurationSeconds(Number.isFinite(audio.duration) ? audio.duration : 0);
      onAudioReady?.(audio.duration);
    };
    const handleError = (): void => onAudioError?.();
    const handlePlay = (): void => setIsPlaying(true);
    const handlePause = (): void => setIsPlaying(false);
    const handleEnded = (): void => setIsPlaying(false);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoaded);
    audio.addEventListener("error", handleError);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoaded);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [onAudioError, onAudioReady]);

  useEffect(() => {
    if (!activeSegmentId || !showTranscript) {
      return;
    }
    segmentRefs.current[activeSegmentId]?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }, [activeSegmentId, showTranscript]);

  function togglePlayback(): void {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    if (audio.paused) {
      void audio.play().catch(() => setIsPlaying(false));
      return;
    }
    audio.pause();
  }

  function seek(nextValue: number | number[]): void {
    const nextTime = Array.isArray(nextValue) ? nextValue[0] ?? 0 : nextValue ?? 0;
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = nextTime;
    }
    setCurrentTime(nextTime);
  }

  function replaySegment(segment: SyncedSegment | TranscriptSegment): void {
    const audio = audioRef.current;
    const startSeconds = getStartSeconds(segment);
    if (!audio || startSeconds < 0) {
      return;
    }
    audio.currentTime = startSeconds;
    void audio.play();
  }

  return (
    <Stack spacing={2} data-testid="audio-transcript">
      {audioUrl ? (
        <Box
          sx={{
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            boxShadow: "0 16px 40px rgba(18, 32, 68, 0.08)",
            p: { xs: 2, sm: 2.5 },
          }}
        >
          <Box component="audio" ref={audioRef} src={audioUrl} preload="metadata" sx={{ display: "none" }} />
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
              <IconButton
                aria-label={isPlaying ? t("audio.pause", { ns: "learning" }) : t("audio.play", { ns: "learning" })}
                color="primary"
                onClick={togglePlayback}
                sx={{ height: 56, width: 56 }}
              >
                {isPlaying ? <PauseCircleFilledIcon sx={{ fontSize: 54 }} /> : <PlayCircleFilledIcon sx={{ fontSize: 54 }} />}
              </IconButton>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="overline" color="text.secondary">
                  {t("audio.nowPlaying", { ns: "learning" })}
                </Typography>
                <Typography noWrap data-testid="current-segment-text" sx={{ fontWeight: 800 }}>
                  {getCurrentLine(displaySegments, activeSegmentId)}
                </Typography>
              </Box>
              <VolumeUpIcon color="action" />
            </Stack>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <Typography variant="caption" sx={{ width: 42, fontVariantNumeric: "tabular-nums" }}>
                {formatTime(currentTime)}
              </Typography>
              <Slider
                aria-label={t("audio.seek", { ns: "learning" })}
                max={durationSeconds || 1}
                min={0}
                onChange={(_event, value) => seek(value)}
                size="small"
                value={Math.min(currentTime, durationSeconds || currentTime)}
              />
              <Typography variant="caption" sx={{ width: 42, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
                {formatTime(durationSeconds)}
              </Typography>
            </Stack>
          </Stack>
        </Box>
      ) : (
        <Alert severity="warning">{t("audioRequired", { ns: "errors" })}</Alert>
      )}

      {showTranscript ? (
        <Stack
          spacing={1}
          sx={{
            maxHeight: { xs: 360, sm: 440 },
            overflowY: "auto",
            pr: 0.5,
            scrollBehavior: "smooth",
          }}
        >
          {displaySegments.map((segment) => (
            <Stack
              key={getSegmentId(segment)}
              ref={(node) => {
                segmentRefs.current[getSegmentId(segment)] = node;
              }}
              data-testid={`segment-${getSegmentId(segment)}`}
              direction="row"
              spacing={1}
              sx={{
                alignItems: "flex-start",
                bgcolor: getSegmentId(segment) === activeSegmentId ? "rgba(36, 84, 214, 0.08)" : "background.paper",
                border: "1px solid",
                borderColor: getSegmentId(segment) === activeSegmentId ? "primary.main" : "divider",
                borderRadius: 2,
                boxShadow: getSegmentId(segment) === activeSegmentId ? "0 10px 24px rgba(36, 84, 214, 0.14)" : "none",
                p: 1.5,
                transition: "background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
              }}
            >
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: getSegmentId(segment) === activeSegmentId ? 700 : 500 }}>{segment.englishText}</Typography>
                {segment.chineseText ? <Typography color="text.secondary">{segment.chineseText}</Typography> : null}
              </Box>
              <IconButton aria-label={t("audio.replaySegment", { ns: "learning" })} onClick={() => replaySegment(segment)}>
                <ReplayIcon />
              </IconButton>
            </Stack>
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}

function getCurrentLine(segments: Array<SyncedSegment | TranscriptSegment>, activeSegmentId: string | undefined): string {
  const activeSegment = segments.find((segment) => getSegmentId(segment) === activeSegmentId);
  return activeSegment?.englishText ?? segments[0]?.englishText ?? "";
}

function getSegmentId(segment: SyncedSegment | TranscriptSegment | undefined): string {
  if (!segment) {
    return "";
  }
  if ("transcriptSegmentId" in segment && segment.transcriptSegmentId) {
    return segment.transcriptSegmentId;
  }
  return segment.segmentId ?? segment.id ?? "";
}

function getStartSeconds(segment: SyncedSegment | TranscriptSegment): number {
  if ("startMs" in segment && typeof segment.startMs === "number") {
    return segment.startMs / 1000;
  }
  if ("startTimeSeconds" in segment && typeof segment.startTimeSeconds === "number") {
    return segment.startTimeSeconds;
  }
  return -1;
}

function getEndSeconds(segment: SyncedSegment | TranscriptSegment): number {
  if ("endMs" in segment && typeof segment.endMs === "number") {
    return segment.endMs / 1000;
  }
  if ("endTimeSeconds" in segment && typeof segment.endTimeSeconds === "number") {
    return segment.endTimeSeconds;
  }
  return -1;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0:00";
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}
