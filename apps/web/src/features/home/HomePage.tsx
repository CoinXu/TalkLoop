import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import LoginIcon from "@mui/icons-material/Login";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { AppCard } from "../../components/ui/AppCard";
import { PageShell } from "../../components/ui/PageShell";
import type { HomeResponse, HomeUnitCard, Session } from "../../types";

interface HomePageProps {
  home: HomeResponse;
  session: Session | null;
  loading: boolean;
  error: string | null;
  onOpenAdmin: () => void;
  onRefresh: () => void;
  onOpenUnit: (unitId: string) => void;
  onLogin: () => void;
}

export function HomePage({
  error,
  home,
  loading,
  onLogin,
  onOpenAdmin,
  onOpenUnit,
  onRefresh,
  session,
}: HomePageProps): JSX.Element {
  const { t } = useTranslation(["common", "home"]);
  const continueLearning = home.continueLearning;
  const continueLearningUnitId = continueLearning?.unitId ?? continueLearning?.contentUnitId;
  const hasContinueLearning = Boolean(session && continueLearningUnitId);

  return (
    <PageShell testId="home-page">
      <Stack direction="row" spacing={2} sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="overline" color="primary">
            {t("appName", { ns: "common" })}
          </Typography>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>
            {t("title", { ns: "home" })}
          </Typography>
        </Box>
        {session ? (
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Chip
              color={session.isInternalTester ? "secondary" : "default"}
              label={session.isInternalTester ? t("status.internalTester", { ns: "common" }) : t("status.loggedIn", { ns: "common" })}
            />
            <Tooltip title={t("actions.admin", { ns: "common" })}>
              <IconButton aria-label={t("actions.admin", { ns: "common" })} onClick={onOpenAdmin} data-testid="admin-entry">
                <AdminPanelSettingsIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        ) : (
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Tooltip title={t("actions.admin", { ns: "common" })}>
              <IconButton aria-label={t("actions.admin", { ns: "common" })} onClick={onOpenAdmin} data-testid="admin-entry">
                <AdminPanelSettingsIcon />
              </IconButton>
            </Tooltip>
            <IconButton aria-label={t("actions.login", { ns: "common" })} onClick={onLogin} data-testid="login-entry">
              <LoginIcon />
            </IconButton>
          </Stack>
        )}
      </Stack>

      {error ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={onRefresh}>
              {t("actions.retry", { ns: "common" })}
            </Button>
          }
        >
          {error}
        </Alert>
      ) : null}

      {hasContinueLearning ? (
        <AppCard testId="continue-learning">
          <Stack spacing={2}>
            <Box>
              <Typography variant="overline" color="primary">
                {t("continueLearning", { ns: "home" })}
              </Typography>
              <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
                {continueLearning?.title ?? continueLearning?.expression ?? t("resumeFallback", { ns: "home" })}
              </Typography>
              <Typography color="text.secondary">{renderStep(continueLearning?.currentStep, t)}</Typography>
            </Box>
            <Button fullWidth variant="contained" onClick={() => onOpenUnit(continueLearningUnitId ?? "")}>
              {t("actions.continue", { ns: "common" })}
            </Button>
          </Stack>
        </AppCard>
      ) : null}

      <Stack spacing={1.5}>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
            {loading ? t("states.loading", { ns: "common" }) : t("unitList", { ns: "home" })}
          </Typography>
          <Button startIcon={<RefreshIcon />} onClick={onRefresh} size="small">
            {t("actions.refresh", { ns: "common" })}
          </Button>
        </Stack>
        {loading ? <CircularProgress size={24} /> : null}
        {home.units.length === 0 && !loading ? (
          <Alert severity="info">{t("emptyUnits", { ns: "home" })}</Alert>
        ) : null}
        {home.units.map((unit) => (
          <UnitCard key={unit.unitId} unit={unit} onOpenUnit={onOpenUnit} />
        ))}
      </Stack>
    </PageShell>
  );
}

function UnitCard({ onOpenUnit, unit }: { unit: HomeUnitCard; onOpenUnit: (unitId: string) => void }): JSX.Element {
  const { t } = useTranslation(["common", "home"]);
  const completed = unit.completionStatus === "completed";
  const statusLabel =
    unit.completionStatus === "completed"
      ? t("status.completed", { ns: "common" })
      : unit.completionStatus === "in_progress"
        ? t("status.inProgress", { ns: "common" })
        : t("status.notStarted", { ns: "common" });

  return (
    <AppCard testId={`unit-card-${unit.unitId}`}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start", justifyContent: "space-between" }}>
          <Box>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
              <Chip size="small" label={unit.difficulty} />
              <Chip size="small" icon={<AccessTimeIcon />} label={t("estimatedMinutes", { ns: "home", count: unit.estimatedMinutes })} />
              <Chip size="small" color={completed ? "success" : "default"} label={statusLabel} />
              {unit.isInternalOnly ? <Chip size="small" color="secondary" label={t("status.internalTester", { ns: "common" })} /> : null}
            </Stack>
            <Typography variant="h6" component="h3" sx={{ fontWeight: 700, mt: 1.5 }}>
              {unit.title}
            </Typography>
            <Typography color="primary" sx={{ fontWeight: 700 }}>
              {unit.expression}
            </Typography>
            <Typography color="text.secondary">{unit.expressionMeaning}</Typography>
          </Box>
          {unit.recentScore !== undefined ? (
            <Chip color="primary" label={t("recentScore", { ns: "home", score: unit.recentScore })} />
          ) : null}
        </Stack>
        <Divider />
        <Button fullWidth variant={completed ? "outlined" : "contained"} onClick={() => onOpenUnit(unit.unitId)}>
          {completed
            ? t("reviewAgain", { ns: "home" })
            : unit.completionStatus === "in_progress"
              ? t("actions.continue", { ns: "common" })
              : t("actions.start", { ns: "common" })}
        </Button>
      </Stack>
    </AppCard>
  );
}

function renderStep(step: string | undefined, t: TFunction<["common", "home"]>): string {
  return step
    ? String(t(`resumeStep.${step}`, { ns: "home", defaultValue: t("resumeStep.default", { ns: "home" }) }))
    : String(t("resumeStep.default", { ns: "home" }));
}
