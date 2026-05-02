import { Box, Button, LinearProgress, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { ScoreRecord } from "../../types";
import { AppCard } from "../ui/AppCard";

interface ScoreResultProps {
  score: ScoreRecord;
  onRetry: () => void;
}

export function ScoreResult({ onRetry, score }: ScoreResultProps): JSX.Element {
  const { t } = useTranslation("learning");

  return (
    <AppCard testId="score-result">
      <Stack spacing={2}>
        <Box sx={{ textAlign: "center" }}>
          <Typography variant="overline">{t("score.result")}</Typography>
          <Typography variant="h2" component="p" color="primary" sx={{ fontWeight: 800 }}>
            {score.overallScore}
          </Typography>
          <Typography color="text.secondary">{score.targetText}</Typography>
        </Box>
        <Dimension label={t("score.pronunciation")} value={score.pronunciationScore} />
        <Dimension label={t("score.fluency")} value={score.fluencyScore} />
        <Dimension label={t("score.completeness")} value={score.completenessScore} />
        {score.recordingUrl ? <audio controls src={score.recordingUrl} /> : null}
        <Button variant="outlined" onClick={onRetry}>
          {t("score.tryAgain")}
        </Button>
      </Stack>
    </AppCard>
  );
}

function Dimension({ label, value }: { label: string; value: number | null | undefined }): JSX.Element | null {
  if (value === undefined || value === null) {
    return null;
  }

  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: "space-between" }}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {value}
        </Typography>
      </Stack>
      <LinearProgress variant="determinate" value={value} sx={{ mt: 0.5 }} />
    </Box>
  );
}
