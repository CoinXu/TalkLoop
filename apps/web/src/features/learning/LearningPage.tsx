import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ReplayIcon from "@mui/icons-material/Replay";
import { Alert, Box, Button, Chip, CircularProgress, IconButton, Stack, Step, StepLabel, Stepper, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { saveProgress, submitScore } from "../../api/learningApi";
import { ApiError } from "../../api/client";
import { AudioTranscript } from "../../components/business/AudioTranscript";
import { RecorderPanel } from "../../components/business/RecorderPanel";
import type { RecordedAudio } from "./hooks/useRecorder";
import { ScoreResult } from "../../components/business/ScoreResult";
import { AppCard } from "../../components/ui/AppCard";
import { BottomActionBar } from "../../components/ui/BottomActionBar";
import { PageShell } from "../../components/ui/PageShell";
import type { LearningStep, LearningUnitResponse, ScoreRecord, Session, SpeakingPrompt, TargetSentence } from "../../types";
import { canCompleteUnit, getNextStep, getProgressStatus, learningSteps } from "./learningFlow";

interface LearningPageProps {
  loading: boolean;
  error: string | null;
  session: Session | null;
  unit: LearningUnitResponse | null;
  unitId: string;
  onBack: () => void;
  onLoginRequired: (reason: string, afterLogin?: () => void) => void;
  onReload: () => void;
}

export function LearningPage({
  error,
  loading,
  onBack,
  onLoginRequired,
  onReload,
  session,
  unit,
  unitId,
}: LearningPageProps): JSX.Element {
  const { t } = useTranslation(["common", "errors", "learning"]);
  const [step, setStep] = useState<LearningStep>("listen_original");
  const [score, setScore] = useState<ScoreRecord | null>(null);
  const [recording, setRecording] = useState<RecordedAudio | null>(null);
  const [resettingUnit, setResettingUnit] = useState(false);
  const [submittingScore, setSubmittingScore] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [audioDurationSeconds, setAudioDurationSeconds] = useState<number | undefined>();
  const activeStep = learningSteps.indexOf(step);

  useEffect(() => {
    if (unit?.progress?.currentStep) {
      setStep(unit.progress.currentStep);
    }
  }, [unit?.progress?.currentStep]);

  const target = unit?.targets[0];
  const prompt = unit?.prompts[0];
  const canUseAudioSteps = Boolean(unit?.audio?.url);
  const stepTitle = getStepLabel(step, t);

  const scoreTarget = useMemo(
    () => getScoreTarget(step, target, prompt),
    [prompt, step, target],
  );

  async function persist(nextStep: LearningStep, hasPromptScore: boolean): Promise<void> {
    if (!unit) {
      return;
    }
    if (!session) {
      return;
    }
    await saveProgress(resolveUnitId(unit, unitId), nextStep, getProgressStatus(nextStep, hasPromptScore));
  }

  async function goNext(): Promise<void> {
    if (!unit) {
      return;
    }
    if ((step === "target_shadowing" || step === "speaking_prompt") && !canUseAudioSteps) {
      return;
    }
    const nextStep = getNextStep(step);
    setStep(nextStep);
    await persist(nextStep, canCompleteUnit(score));
  }

  async function handleSubmitScore(): Promise<void> {
    if (!unit || !scoreTarget || !recording) {
      return;
    }
    if (!session) {
      onLoginRequired(t("authRequired", { ns: "errors" }), () => void handleSubmitScore());
      return;
    }

    setSubmittingScore(true);
    try {
      const result = await submitScore({
        unitId: resolveUnitId(unit, unitId),
        scoreTargetType: scoreTarget.type,
        targetId: scoreTarget.id,
        targetText: scoreTarget.text,
        recordingBase64: recording.base64,
        recordingMimeType: recording.mimeType,
      });
      setScore(result);
      setStep("score_result");
      await persist("score_result", canCompleteUnit(result));
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        onLoginRequired(t("authRequired", { ns: "errors" }), () => void handleSubmitScore());
      }
    } finally {
      setSubmittingScore(false);
    }
  }

  async function handleResetUnit(): Promise<void> {
    if (!unit) {
      return;
    }

    setResettingUnit(true);
    try {
      if (session) {
        await saveProgress(resolveUnitId(unit, unitId), "listen_original", "not_started");
      }
      setStep("listen_original");
      setScore(null);
      setRecording(null);
      setShowAnswer(false);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        onLoginRequired(t("authRequired", { ns: "errors" }), () => void handleResetUnit());
      }
    } finally {
      setResettingUnit(false);
    }
  }

  if (loading) {
    return (
      <PageShell testId="learning-page">
        <CircularProgress />
      </PageShell>
    );
  }

  if (error || !unit) {
    return (
      <PageShell testId="learning-page">
        <IconButton aria-label={t("actions.back", { ns: "common" })} onClick={onBack}>
          <ArrowBackIcon />
        </IconButton>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={onReload}>
              {t("actions.retry", { ns: "common" })}
            </Button>
          }
        >
          {error ?? t("loadFailed", { ns: "errors" })}
        </Alert>
      </PageShell>
    );
  }

  return (
    <PageShell
      testId="learning-page"
      bottomAction={
        step === "score_result" && score ? null : (
          <BottomActionBar
            disabled={(step === "target_shadowing" || step === "speaking_prompt") && !canUseAudioSteps}
            loading={submittingScore}
            onPrimary={step === "target_shadowing" || step === "speaking_prompt" ? () => void handleSubmitScore() : () => void goNext()}
            primaryLabel={
              step === "target_shadowing" || step === "speaking_prompt"
                ? t("recorder.submit", { ns: "learning" })
                : t("actions.continue", { ns: "common" })
            }
            primaryTestId="learning-primary-action"
            secondary={
              <Button type="button" variant="outlined" onClick={onBack} startIcon={<ArrowBackIcon />}>
                {t("actions.back", { ns: "common" })}
              </Button>
            }
          />
        )
      }
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
          <IconButton aria-label={t("actions.back", { ns: "common" })} onClick={onBack}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ minWidth: 0 }}>
            <Typography noWrap variant="h5" component="h1" sx={{ fontWeight: 800 }}>
              {String(unit.unit.title ?? "")}
            </Typography>
            <Typography noWrap color="primary" sx={{ fontWeight: 700 }}>
              {String(unit.unit.expression ?? "")}
            </Typography>
          </Box>
        </Stack>
        <Button
          disabled={resettingUnit || submittingScore}
          onClick={() => void handleResetUnit()}
          startIcon={<ReplayIcon />}
          type="button"
          variant="outlined"
          data-testid="reset-unit-action"
          sx={{ flexShrink: 0 }}
        >
          {t("unit.reset", { ns: "learning" })}
        </Button>
      </Stack>

      <Stepper activeStep={activeStep} alternativeLabel>
        {learningSteps.map((item) => (
          <Step key={item}>
            <StepLabel>{getStepLabel(item, t)}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <AppCard>
        <Stack spacing={1}>
          <Typography variant="overline">{stepTitle}</Typography>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
            {String(unit.unit.expressionMeaning ?? "")}
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            {unit.unit.difficulty ? <Chip label={`${t("entry.difficulty", { ns: "learning" })}: ${String(unit.unit.difficulty)}`} /> : null}
            {unit.unit.estimatedMinutes ? (
              <Chip label={t("entry.minutes", { ns: "learning", count: Number(unit.unit.estimatedMinutes) })} />
            ) : null}
          </Stack>
        </Stack>
      </AppCard>

      {step === "listen_original" ? (
        <AudioTranscript
          audioUrl={unit.audio?.url ?? undefined}
          segments={unit.segments}
          showTranscript={false}
          synced={unit.synced}
          onAudioReady={setAudioDurationSeconds}
        />
      ) : null}

      {step === "intensive_listening" ? (
        <AudioTranscript
          audioUrl={unit.audio?.url ?? undefined}
          segments={unit.segments}
          showTranscript
          synced={unit.synced}
          onAudioReady={setAudioDurationSeconds}
        />
      ) : null}

      {step === "target_shadowing" && target ? (
        <PracticeBlock
          referenceDurationSeconds={audioDurationSeconds}
          targetText={target.englishText}
          promptText={target.chinesePrompt}
          onRecorded={setRecording}
        />
      ) : null}

      {step === "speaking_prompt" && prompt ? (
        <AppCard testId="speaking-prompt">
          <Stack spacing={2}>
            <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
              {prompt.chineseScenario}
            </Typography>
            <Alert severity="info">{prompt.englishPromptGap}</Alert>
            <Button type="button" variant="text" onClick={() => setShowAnswer((current) => !current)}>
              {showAnswer ? t("answer.hide", { ns: "learning" }) : t("answer.show", { ns: "learning" })}
            </Button>
            {showAnswer ? <Alert severity="success">{prompt.expectedAnswer}</Alert> : null}
            <RecorderPanel referenceDurationSeconds={audioDurationSeconds} onRecorded={setRecording} />
          </Stack>
        </AppCard>
      ) : null}

      {step === "score_result" && score ? (
        <ScoreResult
          score={score}
          onRetry={() => {
            setRecording(null);
            setScore(null);
            setStep(score.scoreTargetType === "speaking_prompt" ? "speaking_prompt" : "target_shadowing");
          }}
        />
      ) : null}

      {canCompleteUnit(score) ? (
        <Alert icon={<CheckCircleIcon />} severity="success">
          {t("status.completed", { ns: "common" })}
        </Alert>
      ) : null}
    </PageShell>
  );
}

function PracticeBlock({
  onRecorded,
  promptText,
  referenceDurationSeconds,
  targetText,
}: {
  targetText: string;
  promptText: string;
  referenceDurationSeconds: number | undefined;
  onRecorded: (audio: RecordedAudio | null) => void;
}): JSX.Element {
  const { t } = useTranslation("learning");

  return (
    <AppCard testId="target-shadowing">
      <Stack spacing={2}>
        <Box>
          <Typography variant="overline">{t("score.target")}</Typography>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {targetText}
          </Typography>
          <Typography color="text.secondary">{promptText}</Typography>
        </Box>
        <RecorderPanel referenceDurationSeconds={referenceDurationSeconds} onRecorded={onRecorded} />
      </Stack>
    </AppCard>
  );
}

function getStepLabel(step: LearningStep, t: TFunction<["common", "errors", "learning"]>): string {
  const keyByStep: Record<LearningStep, string> = {
    intensive_listening: "steps.intensiveListening",
    listen_original: "steps.listenOriginal",
    score_result: "steps.scoreResult",
    speaking_prompt: "steps.speakingPrompt",
    target_shadowing: "steps.targetShadowing",
  };

  return String(t(keyByStep[step], { ns: "learning" }));
}

function getScoreTarget(
  step: LearningStep,
  target: TargetSentence | undefined,
  prompt: SpeakingPrompt | undefined,
): { id: string; text: string; type: "target_sentence" | "speaking_prompt" } | null {
  if (step === "target_shadowing" && target) {
    return { id: target.targetSentenceId ?? target.id ?? "", text: target.englishText, type: "target_sentence" };
  }
  if (step === "speaking_prompt" && prompt) {
    return { id: prompt.speakingPromptId ?? prompt.id ?? "", text: prompt.expectedAnswer, type: "speaking_prompt" };
  }
  return null;
}

function resolveUnitId(unit: LearningUnitResponse, routeUnitId: string): string {
  const id = unit.unit.unitId ?? unit.unit.id ?? unit.unit.contentUnitId;
  return typeof id === "string" && id ? id : routeUnitId;
}
