import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import PublishIcon from "@mui/icons-material/Publish";
import SaveIcon from "@mui/icons-material/Save";
import SyncIcon from "@mui/icons-material/Sync";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import { autoSyncContentUnit, createContentUnit, importBbcContentUnit, importLearningUnit, publishContentUnit } from "../../api/adminApi";
import { AppCard } from "../../components/ui/AppCard";
import { PageShell } from "../../components/ui/PageShell";
import type {
  AdminContentUnitResponse,
  CreateContentUnitInput,
  ImportLearningUnitInput,
  CreateSpeakingPromptInput,
  CreateTargetSentenceInput,
  CreateTranscriptSegmentInput,
  ImportBbcResponse,
  ImportLearningUnitResponse,
  LicenseStatus,
  Session,
  SourceType,
} from "../../types";

interface AdminContentPageProps {
  session: Session | null;
  section: AdminSection;
  onBack: () => void;
  onLoginRequired: (reason?: string, afterLogin?: () => void) => void;
  onSectionChange: (section: AdminSection) => void;
}

export type AdminSection = "create" | "import" | "operations";

interface AdminFormState {
  title: string;
  expression: string;
  expressionMeaning: string;
  difficulty: string;
  sceneTagsText: string;
  estimatedMinutes: string;
  sourceType: SourceType;
  sourceUrl: string;
  licenseStatus: LicenseStatus;
  audioUrl: string;
  audioDurationSeconds: string;
  audioFormat: string;
  transcriptSegments: CreateTranscriptSegmentInput[];
  targetSentences: TargetSentenceFormInput[];
  speakingPrompts: SpeakingPromptFormInput[];
}

type TargetSentenceFormInput = CreateTargetSentenceInput & { formKey: string };

type SpeakingPromptFormInput = CreateSpeakingPromptInput & { formKey: string };

const defaultSegment: CreateTranscriptSegmentInput = {
  segmentId: "1",
  englishText: "",
  chineseText: "",
  speaker: "",
  segmentOrder: 0,
};

const defaultTarget: TargetSentenceFormInput = {
  englishText: "",
  formKey: "target-1",
  chinesePrompt: "",
  includesExpression: true,
  segmentId: "1",
};

const defaultPrompt: SpeakingPromptFormInput = {
  chineseScenario: "",
  englishPromptGap: "",
  targetExpression: "",
  expectedAnswer: "",
  formKey: "prompt-1",
};

const initialForm: AdminFormState = {
  title: "",
  expression: "",
  expressionMeaning: "",
  difficulty: "intermediate",
  sceneTagsText: "work",
  estimatedMinutes: "5",
  sourceType: "manual_upload",
  sourceUrl: "",
  licenseStatus: "internal_review",
  audioUrl: "",
  audioDurationSeconds: "180",
  audioFormat: "mp3",
  transcriptSegments: [defaultSegment],
  targetSentences: [defaultTarget],
  speakingPrompts: [defaultPrompt],
};

export function AdminContentPage({ onBack, onLoginRequired, onSectionChange, section, session }: AdminContentPageProps): JSX.Element {
  const { t } = useTranslation(["admin", "common", "errors"]);
  const [form, setForm] = useState<AdminFormState>(initialForm);
  const [importBbcUrl, setImportBbcUrl] = useState("");
  const [importAudioUrl, setImportAudioUrl] = useState("");
  const [importPdfUrl, setImportPdfUrl] = useState("");
  const [importAudioPublicUrl, setImportAudioPublicUrl] = useState("");
  const [operationUnitId, setOperationUnitId] = useState("");
  const [saving, setSaving] = useState(false);
  const [importingBbc, setImportingBbc] = useState(false);
  const [importingLearningUnit, setImportingLearningUnit] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdUnit, setCreatedUnit] = useState<AdminContentUnitResponse | null>(null);
  const [operationMessage, setOperationMessage] = useState<string | null>(null);
  const [bbcImportResult, setBbcImportResult] = useState<ImportBbcResponse | null>(null);
  const [learningImportResult, setLearningImportResult] = useState<ImportLearningUnitResponse | null>(null);

  const canSubmit = useMemo(
    () =>
      Boolean(
        form.title.trim() &&
          form.expression.trim() &&
          form.expressionMeaning.trim() &&
          (form.sourceType === "manual_upload" || form.sourceUrl.trim()) &&
          form.audioUrl.trim() &&
          form.audioFormat.trim() &&
          toInt(form.audioDurationSeconds, 0) > 0 &&
          form.transcriptSegments[0]?.englishText.trim() &&
          form.targetSentences[0]?.englishText.trim() &&
          form.speakingPrompts[0]?.expectedAnswer.trim(),
      ),
    [form],
  );

  function patchForm(patch: Partial<AdminFormState>): void {
    setForm((current) => ({ ...current, ...patch }));
  }

  function handleApiError(caught: unknown): void {
    if (caught instanceof ApiError) {
      setError(caught.code === "authRequired" ? t("authRequired", { ns: "errors" }) : caught.message);
    } else {
      setError(caught instanceof Error ? caught.message : t("requestFailed", { ns: "errors" }));
    }
  }

  async function handleSubmit(): Promise<void> {
    if (!session) {
      onLoginRequired(t("authRequired", { ns: "errors" }), handleSubmit);
      return;
    }

    setSaving(true);
    setError(null);
    setCreatedUnit(null);
    setOperationMessage(null);
    try {
      const response = await createContentUnit(toCreateInput(form, session.userId));
      setCreatedUnit(response);
      const unitId = getCreatedUnitId(response);
      if (unitId !== "-") {
        setOperationUnitId(unitId);
      }
    } catch (caught) {
      handleApiError(caught);
    } finally {
      setSaving(false);
    }
  }

  async function handleImportBbc(): Promise<void> {
    if (!session) {
      onLoginRequired(t("authRequired", { ns: "errors" }), handleImportBbc);
      return;
    }

    setImportingBbc(true);
    setError(null);
    setOperationMessage(null);
    setBbcImportResult(null);
    try {
      const response = await importBbcContentUnit(importBbcUrl.trim());
      setBbcImportResult(response);
      if (response.unitId) {
        setOperationUnitId(response.unitId);
      }
    } catch (caught) {
      handleApiError(caught);
    } finally {
      setImportingBbc(false);
    }
  }

  async function handleImportLearningUnit(dryRun: boolean): Promise<void> {
    if (!session) {
      onLoginRequired(t("authRequired", { ns: "errors" }), () => void handleImportLearningUnit(dryRun));
      return;
    }

    setImportingLearningUnit(true);
    setError(null);
    setOperationMessage(null);
    setLearningImportResult(null);
    try {
      const input: ImportLearningUnitInput = {
        audioUrl: importAudioUrl.trim(),
        dryRun,
        pdfUrl: importPdfUrl.trim(),
        uploadedBy: session.userId,
      };
      if (importAudioPublicUrl.trim()) {
        input.audioPublicUrl = importAudioPublicUrl.trim();
      }
      const response = await importLearningUnit(input);
      setLearningImportResult(response);
      if (response.unitId) {
        setOperationUnitId(response.unitId);
      }
    } catch (caught) {
      handleApiError(caught);
    } finally {
      setImportingLearningUnit(false);
    }
  }

  async function handlePublish(): Promise<void> {
    if (!session) {
      onLoginRequired(t("authRequired", { ns: "errors" }), handlePublish);
      return;
    }

    setPublishing(true);
    setError(null);
    setOperationMessage(null);
    try {
      await publishContentUnit(operationUnitId.trim());
      setOperationMessage(t("published", { unitId: operationUnitId.trim() }));
    } catch (caught) {
      handleApiError(caught);
    } finally {
      setPublishing(false);
    }
  }

  async function handleAutoSync(): Promise<void> {
    if (!session) {
      onLoginRequired(t("authRequired", { ns: "errors" }), handleAutoSync);
      return;
    }

    setSyncing(true);
    setError(null);
    setOperationMessage(null);
    try {
      const response = await autoSyncContentUnit(operationUnitId.trim());
      setOperationMessage(t("synced", { unitId: response.unitId }));
    } catch (caught) {
      handleApiError(caught);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <PageShell
      testId="admin-content-page"
      bottomAction={
        section === "create" ? (
          <Button
            data-testid="create-content-unit"
            disabled={!canSubmit || saving}
            fullWidth
            onClick={() => void handleSubmit()}
            startIcon={<SaveIcon />}
            variant="contained"
          >
            {saving ? t("saving") : t("createDraft")}
          </Button>
        ) : null
      }
    >
      <Stack direction="row" spacing={2} sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="overline" color="primary">
            {t("section")}
          </Typography>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>
            {t("title")}
          </Typography>
        </Box>
        <Button onClick={onBack}>{t("actions.back", { ns: "common" })}</Button>
      </Stack>
      <ToggleButtonGroup
        color="primary"
        exclusive
        fullWidth
        onChange={(_event, nextSection: AdminSection | null) => {
          if (nextSection) {
            onSectionChange(nextSection);
          }
        }}
        value={section}
        data-testid="admin-section-nav"
      >
        <ToggleButton value="create">
          <SaveIcon fontSize="small" />
          <Box component="span" sx={{ ml: 0.75 }}>
            {t("sections.create")}
          </Box>
        </ToggleButton>
        <ToggleButton value="import">
          <UploadFileIcon fontSize="small" />
          <Box component="span" sx={{ ml: 0.75 }}>
            {t("sections.import")}
          </Box>
        </ToggleButton>
        <ToggleButton value="operations">
          <SyncIcon fontSize="small" />
          <Box component="span" sx={{ ml: 0.75 }}>
            {t("sections.operations")}
          </Box>
        </ToggleButton>
      </ToggleButtonGroup>

      {!session ? <Alert severity="warning">{t("loginHint")}</Alert> : null}
      {error ? <Alert severity="error">{error}</Alert> : null}
      {createdUnit ? (
        <Alert severity="success" data-testid="created-unit-result">
          {t("created", { unitId: getCreatedUnitId(createdUnit) })}
        </Alert>
      ) : null}
      {operationMessage ? <Alert severity="success">{operationMessage}</Alert> : null}

      {section === "import" ? <AdminImportSection
        bbcImportResult={bbcImportResult}
        importAudioPublicUrl={importAudioPublicUrl}
        importAudioUrl={importAudioUrl}
        importBbcUrl={importBbcUrl}
        importPdfUrl={importPdfUrl}
        importingBbc={importingBbc}
        importingLearningUnit={importingLearningUnit}
        learningImportResult={learningImportResult}
        onImportBbc={() => void handleImportBbc()}
        onImportLearningUnit={(dryRun) => void handleImportLearningUnit(dryRun)}
        onSetImportAudioPublicUrl={setImportAudioPublicUrl}
        onSetImportAudioUrl={setImportAudioUrl}
        onSetImportBbcUrl={setImportBbcUrl}
        onSetImportPdfUrl={setImportPdfUrl}
      /> : null}

      {section === "operations" ? <AdminOperationsSection
        operationUnitId={operationUnitId}
        publishing={publishing}
        syncing={syncing}
        onAutoSync={() => void handleAutoSync()}
        onPublish={() => void handlePublish()}
        onSetOperationUnitId={setOperationUnitId}
      /> : null}

      {section === "create" ? (
        <>
      <AppCard testId="content-unit-basic">
        <Stack spacing={2}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
            {t("basic")}
          </Typography>
          <TextField label={t("fields.title")} value={form.title} onChange={(event) => patchForm({ title: event.target.value })} />
          <TextField
            label={t("fields.expression")}
            value={form.expression}
            onChange={(event) => patchForm({ expression: event.target.value })}
          />
          <TextField
            label={t("fields.expressionMeaning")}
            value={form.expressionMeaning}
            onChange={(event) => patchForm({ expressionMeaning: event.target.value })}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              fullWidth
              label={t("fields.difficulty")}
              value={form.difficulty}
              onChange={(event) => patchForm({ difficulty: event.target.value })}
            />
            <TextField
              fullWidth
              label={t("fields.estimatedMinutes")}
              slotProps={{ htmlInput: { min: 1 } }}
              type="number"
              value={form.estimatedMinutes}
              onChange={(event) => patchForm({ estimatedMinutes: event.target.value })}
            />
          </Stack>
          <TextField
            label={t("fields.sceneTags")}
            value={form.sceneTagsText}
            onChange={(event) => patchForm({ sceneTagsText: event.target.value })}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <FormControl fullWidth>
              <InputLabel id="source-type-label">{t("fields.sourceType")}</InputLabel>
              <Select
                label={t("fields.sourceType")}
                labelId="source-type-label"
                value={form.sourceType}
                onChange={(event) => patchForm({ sourceType: event.target.value as SourceType })}
              >
                <MenuItem value="manual_upload">{t("sourceType.manual_upload")}</MenuItem>
                <MenuItem value="bbc_url_import">{t("sourceType.bbc_url_import")}</MenuItem>
                <MenuItem value="other_url_import">{t("sourceType.other_url_import")}</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="license-status-label">{t("fields.licenseStatus")}</InputLabel>
              <Select
                label={t("fields.licenseStatus")}
                labelId="license-status-label"
                value={form.licenseStatus}
                onChange={(event) => patchForm({ licenseStatus: event.target.value as LicenseStatus })}
              >
                <MenuItem value="unknown">{t("licenseStatus.unknown")}</MenuItem>
                <MenuItem value="internal_review">{t("licenseStatus.internal_review")}</MenuItem>
                <MenuItem value="approved">{t("licenseStatus.approved")}</MenuItem>
                <MenuItem value="restricted">{t("licenseStatus.restricted")}</MenuItem>
                <MenuItem value="rejected">{t("licenseStatus.rejected")}</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          {form.sourceType !== "manual_upload" ? (
            <TextField
              label={t("fields.sourceUrl")}
              value={form.sourceUrl}
              onChange={(event) => patchForm({ sourceUrl: event.target.value })}
            />
          ) : null}
        </Stack>
      </AppCard>

      <AppCard testId="content-unit-audio">
        <Stack spacing={2}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
            {t("audio")}
          </Typography>
          <TextField label={t("fields.audioUrl")} value={form.audioUrl} onChange={(event) => patchForm({ audioUrl: event.target.value })} />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              fullWidth
              label={t("fields.audioDuration")}
              slotProps={{ htmlInput: { min: 0 } }}
              type="number"
              value={form.audioDurationSeconds}
              onChange={(event) => patchForm({ audioDurationSeconds: event.target.value })}
            />
            <TextField
              fullWidth
              label={t("fields.audioFormat")}
              value={form.audioFormat}
              onChange={(event) => patchForm({ audioFormat: event.target.value })}
            />
          </Stack>
        </Stack>
      </AppCard>

      <EditableSection
        addLabel={t("addSegment")}
        title={t("transcript")}
        onAdd={() => patchForm({ transcriptSegments: [...form.transcriptSegments, nextSegment(form.transcriptSegments.length)] })}
      >
        {form.transcriptSegments.map((segment, index) => (
          <TranscriptSegmentFields
            key={segment.segmentId}
            index={index}
            onChange={(next) => patchForm({ transcriptSegments: replaceAt(form.transcriptSegments, index, next) })}
            onRemove={() => patchForm({ transcriptSegments: removeAt(form.transcriptSegments, index, defaultSegment) })}
            segment={segment}
          />
        ))}
      </EditableSection>

      <EditableSection
        addLabel={t("addTarget")}
        title={t("targets")}
        onAdd={() => patchForm({ targetSentences: [...form.targetSentences, nextTarget(form.targetSentences.length)] })}
      >
        {form.targetSentences.map((target, index) => (
          <TargetSentenceFields
            key={target.formKey}
            index={index}
            onChange={(next) => patchForm({ targetSentences: replaceAt(form.targetSentences, index, next) })}
            onRemove={() => patchForm({ targetSentences: removeAt(form.targetSentences, index, defaultTarget) })}
            segmentIds={form.transcriptSegments.map((segment) => segment.segmentId)}
            target={target}
          />
        ))}
      </EditableSection>

      <EditableSection
        addLabel={t("addPrompt")}
        title={t("prompts")}
        onAdd={() => patchForm({ speakingPrompts: [...form.speakingPrompts, nextPrompt(form.speakingPrompts.length)] })}
      >
        {form.speakingPrompts.map((prompt, index) => (
          <SpeakingPromptFields
            key={prompt.formKey}
            index={index}
            onChange={(next) => patchForm({ speakingPrompts: replaceAt(form.speakingPrompts, index, next) })}
            onRemove={() => patchForm({ speakingPrompts: removeAt(form.speakingPrompts, index, defaultPrompt) })}
            prompt={prompt}
          />
        ))}
      </EditableSection>
        </>
      ) : null}
    </PageShell>
  );
}

interface AdminImportSectionProps {
  bbcImportResult: ImportBbcResponse | null;
  importAudioPublicUrl: string;
  importAudioUrl: string;
  importBbcUrl: string;
  importPdfUrl: string;
  importingBbc: boolean;
  importingLearningUnit: boolean;
  learningImportResult: ImportLearningUnitResponse | null;
  onImportBbc: () => void;
  onImportLearningUnit: (dryRun: boolean) => void;
  onSetImportAudioPublicUrl: (value: string) => void;
  onSetImportAudioUrl: (value: string) => void;
  onSetImportBbcUrl: (value: string) => void;
  onSetImportPdfUrl: (value: string) => void;
}

function AdminImportSection({
  bbcImportResult,
  importAudioPublicUrl,
  importAudioUrl,
  importBbcUrl,
  importPdfUrl,
  importingBbc,
  importingLearningUnit,
  learningImportResult,
  onImportBbc,
  onImportLearningUnit,
  onSetImportAudioPublicUrl,
  onSetImportAudioUrl,
  onSetImportBbcUrl,
  onSetImportPdfUrl,
}: AdminImportSectionProps): JSX.Element {
  const { t } = useTranslation("admin");

  return (
    <AppCard testId="content-import">
      <Stack spacing={2}>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
          {t("import.title")}
        </Typography>
        <Stack spacing={1.5}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {t("import.bbc")}
          </Typography>
          <TextField label={t("fields.sourceUrl")} value={importBbcUrl} onChange={(event) => onSetImportBbcUrl(event.target.value)} />
          <Button disabled={!importBbcUrl.trim() || importingBbc} onClick={onImportBbc} startIcon={<CloudDownloadIcon />} variant="outlined">
            {importingBbc ? t("import.importing") : t("import.importBbc")}
          </Button>
          {bbcImportResult ? (
            <Alert severity="success" data-testid="bbc-import-result">
              {t("import.bbcResult", { jobId: bbcImportResult.jobId, unitId: bbcImportResult.unitId ?? "-" })}
            </Alert>
          ) : null}
        </Stack>
        <Stack spacing={1.5}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {t("import.learningUnit")}
          </Typography>
          <TextField label={t("fields.audioUrl")} value={importAudioUrl} onChange={(event) => onSetImportAudioUrl(event.target.value)} />
          <TextField label={t("fields.pdfUrl")} value={importPdfUrl} onChange={(event) => onSetImportPdfUrl(event.target.value)} />
          <TextField
            label={t("fields.audioPublicUrl")}
            value={importAudioPublicUrl}
            onChange={(event) => onSetImportAudioPublicUrl(event.target.value)}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button disabled={!importAudioUrl.trim() || !importPdfUrl.trim() || importingLearningUnit} onClick={() => onImportLearningUnit(true)} variant="outlined">
              {t("import.preview")}
            </Button>
            <Button
              disabled={!importAudioUrl.trim() || !importPdfUrl.trim() || importingLearningUnit}
              onClick={() => onImportLearningUnit(false)}
              startIcon={<CloudDownloadIcon />}
              variant="contained"
            >
              {importingLearningUnit ? t("import.importing") : t("import.createFromFiles")}
            </Button>
          </Stack>
          {learningImportResult ? (
            <Alert severity={learningImportResult.dryRun ? "info" : "success"} data-testid="learning-import-result">
              {t("import.learningResult", {
                count: learningImportResult.transcriptSegmentCount,
                title: learningImportResult.title,
                unitId: learningImportResult.unitId ?? "-",
              })}
            </Alert>
          ) : null}
        </Stack>
      </Stack>
    </AppCard>
  );
}

interface AdminOperationsSectionProps {
  operationUnitId: string;
  publishing: boolean;
  syncing: boolean;
  onAutoSync: () => void;
  onPublish: () => void;
  onSetOperationUnitId: (value: string) => void;
}

function AdminOperationsSection({
  operationUnitId,
  publishing,
  syncing,
  onAutoSync,
  onPublish,
  onSetOperationUnitId,
}: AdminOperationsSectionProps): JSX.Element {
  const { t } = useTranslation("admin");

  return (
    <AppCard testId="content-operations">
      <Stack spacing={2}>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
          {t("operations.title")}
        </Typography>
        <TextField label={t("fields.unitId")} value={operationUnitId} onChange={(event) => onSetOperationUnitId(event.target.value)} />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button disabled={!operationUnitId.trim() || syncing} onClick={onAutoSync} startIcon={<SyncIcon />} variant="outlined">
            {syncing ? t("operations.syncing") : t("operations.autoSync")}
          </Button>
          <Button disabled={!operationUnitId.trim() || publishing} onClick={onPublish} startIcon={<PublishIcon />} variant="contained">
            {publishing ? t("operations.publishing") : t("operations.publish")}
          </Button>
        </Stack>
      </Stack>
    </AppCard>
  );
}

interface EditableSectionProps {
  addLabel: string;
  children: ReactNode;
  onAdd: () => void;
  title: string;
}

function EditableSection({ addLabel, children, onAdd, title }: EditableSectionProps): JSX.Element {
  return (
    <AppCard>
      <Stack spacing={2}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          <Button onClick={onAdd} startIcon={<AddIcon />} size="small">
            {addLabel}
          </Button>
        </Stack>
        {children}
      </Stack>
    </AppCard>
  );
}

interface TranscriptSegmentFieldsProps {
  index: number;
  onChange: (segment: CreateTranscriptSegmentInput) => void;
  onRemove: () => void;
  segment: CreateTranscriptSegmentInput;
}

function TranscriptSegmentFields({ index, onChange, onRemove, segment }: TranscriptSegmentFieldsProps): JSX.Element {
  const { t } = useTranslation("admin");
  return (
    <Stack spacing={1.5}>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Typography sx={{ fontWeight: 700 }}>{t("item", { count: index + 1 })}</Typography>
        <IconButton aria-label={t("remove")} onClick={onRemove} size="small">
          <DeleteIcon />
        </IconButton>
      </Stack>
      <TextField
        label={t("fields.segmentId")}
        value={segment.segmentId}
        onChange={(event) => onChange({ ...segment, segmentId: event.target.value })}
      />
      <TextField
        label={t("fields.englishText")}
        multiline
        minRows={2}
        value={segment.englishText}
        onChange={(event) => onChange({ ...segment, englishText: event.target.value })}
      />
      <TextField
        label={t("fields.chineseText")}
        value={segment.chineseText ?? ""}
        onChange={(event) => onChange({ ...segment, chineseText: event.target.value })}
      />
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          fullWidth
          label={t("fields.speaker")}
          value={segment.speaker ?? ""}
          onChange={(event) => onChange({ ...segment, speaker: event.target.value })}
        />
        <TextField
          fullWidth
          label={t("fields.segmentOrder")}
          slotProps={{ htmlInput: { min: 0 } }}
          type="number"
          value={segment.segmentOrder}
          onChange={(event) => onChange({ ...segment, segmentOrder: toInt(event.target.value, index) })}
        />
      </Stack>
    </Stack>
  );
}

interface TargetSentenceFieldsProps {
  index: number;
  onChange: (target: TargetSentenceFormInput) => void;
  onRemove: () => void;
  segmentIds: string[];
  target: TargetSentenceFormInput;
}

function TargetSentenceFields({ index, onChange, onRemove, segmentIds, target }: TargetSentenceFieldsProps): JSX.Element {
  const { t } = useTranslation("admin");
  return (
    <Stack spacing={1.5}>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Typography sx={{ fontWeight: 700 }}>{t("item", { count: index + 1 })}</Typography>
        <IconButton aria-label={t("remove")} onClick={onRemove} size="small">
          <DeleteIcon />
        </IconButton>
      </Stack>
      <TextField
        label={t("fields.englishText")}
        value={target.englishText}
        onChange={(event) => onChange({ ...target, englishText: event.target.value })}
      />
      <TextField
        label={t("fields.chinesePrompt")}
        value={target.chinesePrompt}
        onChange={(event) => onChange({ ...target, chinesePrompt: event.target.value })}
      />
      <FormControl fullWidth>
        <InputLabel id={`target-segment-${index}`}>{t("fields.segmentId")}</InputLabel>
        <Select
          label={t("fields.segmentId")}
          labelId={`target-segment-${index}`}
          value={target.segmentId}
          onChange={(event) => onChange({ ...target, segmentId: event.target.value })}
        >
          {segmentIds.map((segmentId) => (
            <MenuItem key={segmentId} value={segmentId}>
              {segmentId}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControlLabel
        control={
          <Checkbox
            checked={target.includesExpression}
            onChange={(event) => onChange({ ...target, includesExpression: event.target.checked })}
          />
        }
        label={t("fields.includesExpression")}
      />
    </Stack>
  );
}

interface SpeakingPromptFieldsProps {
  index: number;
  onChange: (prompt: SpeakingPromptFormInput) => void;
  onRemove: () => void;
  prompt: SpeakingPromptFormInput;
}

function SpeakingPromptFields({ index, onChange, onRemove, prompt }: SpeakingPromptFieldsProps): JSX.Element {
  const { t } = useTranslation("admin");
  return (
    <Stack spacing={1.5}>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Typography sx={{ fontWeight: 700 }}>{t("item", { count: index + 1 })}</Typography>
        <IconButton aria-label={t("remove")} onClick={onRemove} size="small">
          <DeleteIcon />
        </IconButton>
      </Stack>
      <TextField
        label={t("fields.chineseScenario")}
        value={prompt.chineseScenario}
        onChange={(event) => onChange({ ...prompt, chineseScenario: event.target.value })}
      />
      <TextField
        label={t("fields.englishPromptGap")}
        value={prompt.englishPromptGap}
        onChange={(event) => onChange({ ...prompt, englishPromptGap: event.target.value })}
      />
      <TextField
        label={t("fields.targetExpression")}
        value={prompt.targetExpression}
        onChange={(event) => onChange({ ...prompt, targetExpression: event.target.value })}
      />
      <TextField
        label={t("fields.expectedAnswer")}
        value={prompt.expectedAnswer}
        onChange={(event) => onChange({ ...prompt, expectedAnswer: event.target.value })}
      />
    </Stack>
  );
}

function nextSegment(length: number): CreateTranscriptSegmentInput {
  const nextIndex = length + 1;
  return {
    ...defaultSegment,
    segmentId: String(nextIndex),
    segmentOrder: length,
  };
}

function nextTarget(length: number): TargetSentenceFormInput {
  return {
    ...defaultTarget,
    formKey: `target-${length + 1}`,
  };
}

function nextPrompt(length: number): SpeakingPromptFormInput {
  return {
    ...defaultPrompt,
    formKey: `prompt-${length + 1}`,
  };
}

function replaceAt<T>(items: T[], index: number, item: T): T[] {
  return items.map((current, currentIndex) => (currentIndex === index ? item : current));
}

function removeAt<T>(items: T[], index: number, fallback: T): T[] {
  const next = items.filter((_, currentIndex) => currentIndex !== index);
  return next.length > 0 ? next : [fallback];
}

function toCreateInput(form: AdminFormState, uploadedBy: string): CreateContentUnitInput {
  const input: CreateContentUnitInput = {
    title: form.title.trim(),
    expression: form.expression.trim(),
    expressionMeaning: form.expressionMeaning.trim(),
    difficulty: form.difficulty.trim(),
    sceneTags: form.sceneTagsText
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    estimatedMinutes: toInt(form.estimatedMinutes, 5),
    sourceType: form.sourceType,
    licenseStatus: form.licenseStatus,
    audioAsset: {
      url: form.audioUrl.trim(),
      durationSeconds: toInt(form.audioDurationSeconds, 0),
      format: form.audioFormat.trim(),
      uploadedBy,
    },
    transcriptSegments: form.transcriptSegments.map((segment, index) => cleanSegment(segment, index)),
    targetSentences: form.targetSentences.map(cleanTarget),
    speakingPrompts: form.speakingPrompts.map(cleanPrompt),
  };
  if (form.sourceType !== "manual_upload") {
    input.sourceUrl = form.sourceUrl.trim();
  }
  return input;
}

function cleanTarget(target: TargetSentenceFormInput): CreateTargetSentenceInput {
  return {
    englishText: target.englishText.trim(),
    chinesePrompt: target.chinesePrompt.trim(),
    includesExpression: target.includesExpression,
    segmentId: target.segmentId.trim(),
  };
}

function cleanPrompt(prompt: SpeakingPromptFormInput): CreateSpeakingPromptInput {
  return {
    chineseScenario: prompt.chineseScenario.trim(),
    englishPromptGap: prompt.englishPromptGap.trim(),
    targetExpression: prompt.targetExpression.trim(),
    expectedAnswer: prompt.expectedAnswer.trim(),
  };
}

function cleanSegment(segment: CreateTranscriptSegmentInput, index: number): CreateTranscriptSegmentInput {
  const next: CreateTranscriptSegmentInput = {
    segmentId: segment.segmentId.trim() || `seg-${index + 1}`,
    englishText: segment.englishText.trim(),
    segmentOrder: segment.segmentOrder,
  };
  const chineseText = segment.chineseText?.trim();
  const speaker = segment.speaker?.trim();
  if (chineseText) {
    next.chineseText = chineseText;
  }
  if (speaker) {
    next.speaker = speaker;
  }
  return next;
}

function toInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getCreatedUnitId(response: AdminContentUnitResponse): string {
  const unitId = response.unitId ?? response.unit?.unitId ?? response.unit?.id;
  return typeof unitId === "string" ? unitId : "-";
}
