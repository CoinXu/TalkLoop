import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import AssessmentIcon from "@mui/icons-material/Assessment";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import FlagIcon from "@mui/icons-material/Flag";
import HeadphonesIcon from "@mui/icons-material/Headphones";
import LibraryBooksIcon from "@mui/icons-material/LibraryBooks";
import LoginIcon from "@mui/icons-material/Login";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import PersonIcon from "@mui/icons-material/Person";
import SaveIcon from "@mui/icons-material/Save";
import RepeatIcon from "@mui/icons-material/Repeat";
import SpellcheckIcon from "@mui/icons-material/Spellcheck";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "./api/client";
import { adminApi, learningApi } from "./api/learningActivationApi";
import { ContentAdminConsole, type ContentAdminModule } from "./features/contentAdmin/components/ContentAdminConsole";
import { TodayPanel, type PracticeResult } from "./features/learning/components/TodayPanel";
import { clearAdminSession, loadAdminSession, saveAdminSession } from "./session/adminSessionStore";
import { clearSession, loadSession, saveSession } from "./session/sessionStore";
import type {
  AdminSession,
  Course,
  DailyTask,
  JsonRecord,
  ListResponse,
  Scene,
  Sentence,
  SubtlexusImportResult,
  SubtlexusWord,
  UserSession,
  VocabularyOverview,
  WordEntry,
  WordMeta,
} from "./types";

type View = "learning" | "admin";
type LearningTab = "today" | "assessment" | "dictionary" | "library" | "courses" | "listen" | "report" | "profile";
type AssessmentExposureKey = "rare" | "occasional" | "familiarReading" | "frequent";
type AdminModule =
  | ContentAdminModule
  | "dashboard"
  | "admin-foundation"
  | "word-library"
  | "corpus-course"
  | "auto-annotation"
  | "assessment"
  | "user-vocabulary"
  | "activation-practice"
  | "daily-task"
  | "listen-repeat"
  | "course-report";

const fallbackUserIdPrefix = "local-demo-user";

const learningTabs: Array<{ key: LearningTab; label: string; icon: JSX.Element }> = [
  { icon: <TaskAltIcon />, key: "today", label: "今日任务" },
  { icon: <AssessmentIcon />, key: "assessment", label: "水平评估" },
  { icon: <SpellcheckIcon />, key: "dictionary", label: "词典" },
  { icon: <SpellcheckIcon />, key: "library", label: "我的词库" },
  { icon: <MenuBookIcon />, key: "courses", label: "课程" },
  { icon: <HeadphonesIcon />, key: "listen", label: "听读" },
  { icon: <FlagIcon />, key: "report", label: "报告" },
  { icon: <PersonIcon />, key: "profile", label: "个人" },
];

const assessmentExposureOptions: Array<{
  key: AssessmentExposureKey;
  label: string;
  vocabularyEstimate: number;
}> = [
  { key: "rare", label: "很少接触英语内容", vocabularyEstimate: 1500 },
  { key: "occasional", label: "偶尔看英语短视频或文章", vocabularyEstimate: 2500 },
  { key: "familiarReading", label: "能读懂熟悉主题文章", vocabularyEstimate: 3500 },
  { key: "frequent", label: "经常听读英文材料", vocabularyEstimate: 5000 },
];

const defaultAssessmentExposure = assessmentExposureOptions[1] as {
  key: AssessmentExposureKey;
  label: string;
  vocabularyEstimate: number;
};

type AdminModuleMeta = { category: "内容生产" | "词库"; icon: JSX.Element; key: AdminModule; label: string; summary: string };

const adminModules: AdminModuleMeta[] = [
  { category: "内容生产", icon: <FactCheckIcon />, key: "overview", label: "内容概览", summary: "场景、课程、未分配句子和发布风险" },
  { category: "内容生产", icon: <LibraryBooksIcon />, key: "content", label: "场景 / 课程", summary: "场景与课程一体管理，课程可直接关联句子" },
  { category: "内容生产", icon: <SpellcheckIcon />, key: "sentences", label: "句子池", summary: "筛选、详情、音频状态和引用信息" },
  { category: "内容生产", icon: <UploadFileIcon />, key: "imports", label: "批量导入", summary: "CSV/JSON 上传、映射、预校验和结果" },
  { category: "内容生产", icon: <RepeatIcon />, key: "composition", label: "课程编排", summary: "左侧句子池、右侧课程句子排序" },
  { category: "内容生产", icon: <FlagIcon />, key: "publishing", label: "发布校验", summary: "状态流转、阻断项和默认音频提示" },
  { category: "词库", icon: <SpellcheckIcon />, key: "word-library", label: "词频 / 单词", summary: "SUBTLEXus 词频导入、词条筛选、单词新建和批量发布" },
];

const defaultAdminModule = adminModules[0] as AdminModuleMeta;

type WordFormState = {
  audioStatus: "missing" | "ready" | "failed";
  audioUrl: string;
  cdCount: string;
  cdLow: string;
  commonCollocations: string;
  difficultyDistractors: string;
  difficultyLevel: string;
  exclusionReason: string;
  frequencyCount: string;
  frequencyLow: string;
  hearingTrap: string;
  isExcluded: boolean;
  lemma: string;
  levelTags: string;
  lg10cd: string;
  lg10wf: string;
  meaningCn: string;
  meaningDistractors: string;
  meaningEn: string;
  partOfSpeech: string;
  phonetic: string;
  pronunciationDistractors: string;
  publishStatus: "draft" | "published" | "archived";
  reason: string;
  reviewStatus: "pending_review" | "approved" | "rejected";
  sceneTags: string;
  subtlcd: string;
  subtlwf: string;
  word: string;
};

type SubtlexusFilterState = {
  importBatchId: string;
  keyword: string;
  limit: string;
  minLg10Wf: string;
  offset: string;
  sortBy: "createdAt" | "updatedAt" | "word" | "freqCount" | "cdCount" | "lg10Wf" | "lg10Cd";
  sortOrder: "asc" | "desc";
};

type CreateFromSubtlexusState = {
  excludeExisting: boolean;
  maxRows: string;
  minLg10Wf: string;
  reason: string;
  words: string;
};

type WordListFilterState = {
  audioStatus: "" | "missing" | "ready" | "failed";
  hasAudio: boolean;
  hasMeaning: boolean;
  isExcluded: boolean;
  keyword: string;
  limit: string;
  minFrequencyCount: string;
  minLg10wf: string;
  offset: string;
  publishStatus: "" | "draft" | "published" | "archived";
  reviewStatus: "" | "pending_review" | "approved" | "rejected";
  sortBy: "createdAt" | "updatedAt" | "word" | "difficultyLevel" | "lg10wf" | "frequencyCount";
  sortOrder: "asc" | "desc";
};

type WordMetaFilterState = {
  importBatchId: string;
  keyword: string;
  limit: string;
  normalizedWord: string;
  offset: string;
  sortBy: "createdAt" | "updatedAt" | "word";
  sortOrder: "asc" | "desc";
  source: string;
};

type BulkWordStatusState = {
  audioStatus: "" | WordFormState["audioStatus"];
  publishStatus: "" | WordFormState["publishStatus"];
  reviewStatus: "" | WordFormState["reviewStatus"];
};

type WordLibraryTab = "subtlexus" | "words" | "wordMeta";

const emptyWordForm: WordFormState = {
  audioStatus: "missing",
  audioUrl: "",
  cdCount: "",
  cdLow: "",
  commonCollocations: "",
  difficultyDistractors: "",
  difficultyLevel: "",
  exclusionReason: "",
  frequencyCount: "",
  frequencyLow: "",
  hearingTrap: "",
  isExcluded: false,
  lemma: "",
  levelTags: "",
  lg10cd: "",
  lg10wf: "",
  meaningCn: "",
  meaningDistractors: "",
  meaningEn: "",
  partOfSpeech: "",
  phonetic: "",
  pronunciationDistractors: "",
  publishStatus: "draft",
  reason: "",
  reviewStatus: "pending_review",
  sceneTags: "",
  subtlcd: "",
  subtlwf: "",
  word: "",
};

const emptySubtlexusFilters: SubtlexusFilterState = {
  importBatchId: "",
  keyword: "",
  limit: "10",
  minLg10Wf: "",
  offset: "0",
  sortBy: "createdAt",
  sortOrder: "desc",
};

const emptyCreateFromSubtlexus: CreateFromSubtlexusState = {
  excludeExisting: true,
  maxRows: "500",
  minLg10Wf: "",
  reason: "",
  words: "",
};

const emptyWordListFilters: WordListFilterState = {
  audioStatus: "",
  hasAudio: false,
  hasMeaning: false,
  isExcluded: false,
  keyword: "",
  limit: "10",
  minFrequencyCount: "",
  minLg10wf: "",
  offset: "0",
  publishStatus: "",
  reviewStatus: "",
  sortBy: "createdAt",
  sortOrder: "desc",
};

const emptyWordMetaFilters: WordMetaFilterState = {
  importBatchId: "",
  keyword: "",
  limit: "10",
  normalizedWord: "",
  offset: "0",
  sortBy: "createdAt",
  sortOrder: "desc",
  source: "",
};

const emptyBulkWordStatus: BulkWordStatusState = {
  audioStatus: "",
  publishStatus: "",
  reviewStatus: "",
};

export function App(): JSX.Element {
  const initialRoute = parseRoute();
  const [view, setView] = useState<View>(initialRoute.view);
  const [learningTab, setLearningTab] = useState<LearningTab>(initialRoute.learningTab);
  const [adminModule, setAdminModule] = useState<AdminModule>(initialRoute.adminModule);
  const [userSession, setUserSession] = useState<UserSession | null>(() => loadSession());
  const [adminSession, setAdminSession] = useState<AdminSession | null>(() => loadAdminSession());
  const [snackbar, setSnackbar] = useState<string | null>(null);

  useEffect(() => {
    const onHashChange = (): void => {
      const next = parseRoute();
      setView(next.view);
      setLearningTab(next.learningTab);
      setAdminModule(next.adminModule);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  function navigate(next: { view: View; learningTab?: LearningTab; adminModule?: AdminModule }): void {
    setView(next.view);
    if (next.learningTab) setLearningTab(next.learningTab);
    if (next.adminModule) setAdminModule(next.adminModule);
    window.location.hash = next.view === "admin" ? `#/admin/${next.adminModule ?? "overview"}` : `#/${next.learningTab ?? "today"}`;
  }

  function ensureUserSession(): UserSession {
    const existing = loadSession();
    if (existing) {
      setUserSession(existing);
      return existing;
    }
    const created = createLocalUserSession();
    saveSession(created);
    setUserSession(created);
    setSnackbar("已创建本地学习身份，可直接完成评估和练习。");
    return created;
  }

  function resetUserSession(): void {
    clearSession();
    const created = createLocalUserSession();
    saveSession(created);
    setUserSession(created);
    setSnackbar("已重新创建本地学习身份，请重新完成水平评估。");
  }

  return (
    <Box className="appShell">
      <AppBar color="inherit" elevation={0} position="sticky">
        <Toolbar className="topBar">
          <Box>
            <Typography component="h1" variant="h6">
              Learning Activation v1.0
            </Typography>
            <Typography color="text.secondary" variant="body2">
              词库、课程、评估、激活练习、听读和报告
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button onClick={() => navigate({ learningTab: "today", view: "learning" })} startIcon={<TaskAltIcon />} variant={view === "learning" ? "contained" : "outlined"}>
              学习端
            </Button>
            <Button onClick={() => navigate({ adminModule: "overview", view: "admin" })} startIcon={<FactCheckIcon />} variant={view === "admin" ? "contained" : "outlined"}>
              管理后台
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      {view === "learning" ? (
        <LearningWorkspace
          ensureUserSession={ensureUserSession}
          onChangeTab={(tab) => navigate({ learningTab: tab, view: "learning" })}
          onResetUserSession={resetUserSession}
          tab={learningTab}
          userSession={userSession}
        />
      ) : (
        <AdminWorkspace
          adminModule={adminModule}
          adminSession={adminSession}
          onChangeModule={(module) => navigate({ adminModule: module, view: "admin" })}
          onSessionChange={setAdminSession}
        />
      )}

      <Snackbar autoHideDuration={3000} message={snackbar} onClose={() => setSnackbar(null)} open={Boolean(snackbar)} />
    </Box>
  );
}

function LearningWorkspace({
  ensureUserSession,
  onChangeTab,
  onResetUserSession,
  tab,
  userSession,
}: {
  ensureUserSession: () => UserSession;
  onChangeTab: (tab: LearningTab) => void;
  onResetUserSession: () => void;
  tab: LearningTab;
  userSession: UserSession | null;
}): JSX.Element {
  const [overview, setOverview] = useState<VocabularyOverview | null>(null);
  const [dailyTask, setDailyTask] = useState<DailyTask | null>(null);
  const [words, setWords] = useState<WordEntry[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [activeAssessment, setActiveAssessment] = useState<JsonRecord | null>(null);
  const [assessmentResult, setAssessmentResult] = useState<JsonRecord | null>(null);
  const [assessmentNotice, setAssessmentNotice] = useState<string | null>(null);
  const [dataWarning, setDataWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUserPlan = useCallback(async (): Promise<{ overview: VocabularyOverview; task: DailyTask | null }> => {
    const nextOverview = await learningApi.vocabulary();
    setOverview(nextOverview);
    if (nextOverview.total <= 0) {
      setDailyTask(null);
      return { overview: nextOverview, task: null };
    }
    try {
      const nextTask = await learningApi.dailyTask();
      setDailyTask(nextTask);
      return { overview: nextOverview, task: nextTask };
    } catch (caught) {
      setDailyTask(null);
      setDataWarning((current) => [current, `今日任务接口暂不可用：${readableError(caught)}`].filter(Boolean).join("；"));
      return { overview: nextOverview, task: null };
    }
  }, []);

  const loadLearning = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDataWarning(null);
    try {
      const warnings: string[] = [];
      const [wordList, courseList, sentenceList, assessment] = await Promise.all([
        learningApi.words(),
        loadOptionalLearningList("课程列表", learningApi.courses, warnings),
        loadOptionalLearningList("句子列表", learningApi.sentences, warnings),
        learningApi.activeAssessment(),
      ]);
      setWords(wordList.items);
      setCourses(courseList.items);
      setSentences(sentenceList.items);
      setActiveAssessment(assessment);
      if (warnings.length > 0) setDataWarning(warnings.join("；"));
      if (loadSession()) {
        await loadUserPlan();
      }
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  }, [loadUserPlan]);

  useEffect(() => {
    void loadLearning();
  }, [loadLearning]);

  async function startAssessment(exposureKey: AssessmentExposureKey): Promise<void> {
    const exposure = assessmentExposureOptions.find((option) => option.key === exposureKey) ?? defaultAssessmentExposure;
    ensureUserSession();
    setLoading(true);
    setError(null);
    setAssessmentNotice(null);
    try {
      const result = await learningApi.submitAssessment({
        answers: [
          exposure.label,
          "能读懂短句和熟悉主题文章",
          "听力痛点：连读、弱读和听音辨词",
        ],
        frequencyBoundary: { maxLg10wf: 5, minLg10wf: 3 },
        painPoints: ["hearing_trap", "slow_recall"],
        vocabularyEstimate: exposure.vocabularyEstimate,
      });
      setAssessmentResult(result);
      const nextPlan = await loadUserPlan();
      if (jsonNumber(result.generatedVocabularyCount) > 0 && (nextPlan.task?.items?.length ?? 0) > 0) {
        onChangeTab("today");
      } else if (jsonNumber(result.generatedVocabularyCount) > 0) {
        setAssessmentNotice("已生成激活词，但今日任务为空。当前学习身份今天可能已经生成过空任务，请到个人页重新创建本地学习身份后再评估。");
      }
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  }

  async function startDailyPlan(): Promise<void> {
    ensureUserSession();
    setLoading(true);
    setError(null);
    try {
      const nextPlan = await loadUserPlan();
      if (nextPlan.overview.total <= 0) {
        onChangeTab("assessment");
        return;
      }
      onChangeTab("today");
    } catch (caught) {
      setError(readableError(caught));
      throw caught;
    } finally {
      setLoading(false);
    }
  }

  async function resetDailyTask(): Promise<void> {
    ensureUserSession();
    setLoading(true);
    setError(null);
    try {
      await learningApi.resetDailyTask();
      await loadUserPlan();
      onChangeTab("today");
    } catch (caught) {
      setError(readableError(caught));
      throw caught;
    } finally {
      setLoading(false);
    }
  }

  async function practiceDailyTaskItem(item: JsonRecord & { itemType?: string; sentenceId?: string | null; wordId?: string | null }, result: PracticeResult): Promise<void> {
    ensureUserSession();
    setLoading(true);
    setError(null);
    try {
      if (item.itemType === "repeat_sentence" && item.sentenceId) {
        await learningApi.listenRepeatAttempt({
          mode: "A",
          sentenceId: item.sentenceId,
          targetWordHits: [],
          textMatchRate: result.isCorrect ? 1 : 0,
          transcript: result.selectedAnswer ?? null,
          waveformSummary: { source: "daily_task", dailyTaskItemId: item.dailyTaskItemId ?? null },
        });
      } else if (item.wordId) {
        await learningApi.activationAttempt({
          correctAnswer: result.correctAnswer ?? null,
          isCorrect: result.isCorrect,
          practiceType: item.itemType === "review_word" ? "review" : "audio_meaning",
          replayCount: 1,
          result: { source: "daily_task", dailyTaskItemId: item.dailyTaskItemId ?? null },
          selectedAnswer: result.selectedAnswer ?? null,
          wordId: item.wordId,
        });
      } else {
        setError("该任务缺少关联词或句子，暂不能练习。");
        return;
      }
      await loadUserPlan();
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  }

  async function submitPractice(sentence: Sentence): Promise<void> {
    ensureUserSession();
    setLoading(true);
    try {
      await learningApi.listenRepeatAttempt({
        mode: "A",
        originalAudioDurationMs: null,
        recordingDurationMs: null,
        sentenceId: sentence.sentenceId,
        targetWordHits: sentence.targetWords ?? [],
        textMatchRate: null,
        transcript: sentence.sentenceText,
      });
      await loadLearning();
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box component="main" className="workspace">
      <Tabs onChange={(_, value: LearningTab) => onChangeTab(value)} scrollButtons="auto" value={tab} variant="scrollable">
        {learningTabs.map((item) => (
          <Tab icon={item.icon} iconPosition="start" key={item.key} label={item.label} value={item.key} />
        ))}
      </Tabs>
      {loading ? <LinearProgress /> : null}
      {error ? <Alert severity="warning">{error}</Alert> : null}
      {dataWarning ? <Alert severity="info">{dataWarning}</Alert> : null}
      {tab === "today" ? (
        <TodayPanel
          dailyTask={dailyTask}
          disabled={loading}
          onPracticeTask={practiceDailyTaskItem}
          onResetDailyTask={resetDailyTask}
          onResetUserSession={onResetUserSession}
          onStartPlan={startDailyPlan}
          overview={overview}
          sentences={sentences}
          userSession={userSession}
          words={words}
        />
      ) : null}
      {tab === "assessment" ? (
        <AssessmentPanel
          activeAssessment={activeAssessment}
          assessmentNotice={assessmentNotice}
          assessmentResult={assessmentResult}
          disabled={loading}
          onStart={startAssessment}
        />
      ) : null}
      {tab === "dictionary" ? <DictionaryPanel /> : null}
      {tab === "library" ? <VocabularyPanel overview={overview} words={words} /> : null}
      {tab === "courses" ? <CoursePanel courses={courses} scenes={[]} sentences={sentences} /> : null}
      {tab === "listen" ? <ListenPanel onSubmit={submitPractice} sentences={sentences} /> : null}
      {tab === "report" ? <ReportPanel courses={courses} overview={overview} /> : null}
      {tab === "profile" ? <ProfilePanel ensureUserSession={ensureUserSession} onResetUserSession={onResetUserSession} userSession={userSession} /> : null}
    </Box>
  );
}

function AssessmentPanel({
  activeAssessment,
  assessmentNotice,
  assessmentResult,
  disabled,
  onStart,
}: {
  activeAssessment: JsonRecord | null;
  assessmentNotice: string | null;
  assessmentResult: JsonRecord | null;
  disabled: boolean;
  onStart: (exposureKey: AssessmentExposureKey) => void;
}): JSX.Element {
  const [selectedExposure, setSelectedExposure] = useState<AssessmentExposureKey>("occasional");
  const generatedCount = jsonNumber(assessmentResult?.generatedVocabularyCount);
  return (
    <Card className="primaryPanel">
      <CardContent>
        <Typography variant="h5">首次水平评估</Typography>
        <Typography color="text.secondary">使用阅读友好的选项收集日常英语接触量、阅读理解熟悉度和听力痛点。</Typography>
        <Stack className="friendlyOptions" spacing={1}>
          {assessmentExposureOptions.map((option) => {
            const selected = option.key === selectedExposure;
            return (
              <Chip
                clickable
                color={selected ? "primary" : "default"}
                key={option.key}
                label={option.label}
                onClick={() => setSelectedExposure(option.key)}
                variant={selected ? "filled" : "outlined"}
              />
            );
          })}
        </Stack>
        <Typography color="text.secondary">当前配置：{String(activeAssessment?.version ?? activeAssessment?.assessmentConfigId ?? "默认 v1.0")}</Typography>
        {assessmentResult ? (
          <Alert severity={generatedCount > 0 ? "success" : "warning"} sx={{ mt: 2 }}>
            {generatedCount > 0
              ? `已生成 ${generatedCount} 个激活词，今日计划会基于这些词生成。`
              : "评估已提交，但没有生成激活词。请先在后台把词条补齐到已审核、已发布、音频就绪且未排除。"}
          </Alert>
        ) : null}
        {assessmentNotice ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            {assessmentNotice}
          </Alert>
        ) : null}
        <Button disabled={disabled} onClick={() => onStart(selectedExposure)} sx={{ mt: 2 }} variant="contained">
          生成我的激活词库
        </Button>
      </CardContent>
    </Card>
  );
}

function VocabularyPanel({ overview, words }: { overview: VocabularyOverview | null; words: WordEntry[] }): JSX.Element {
  const activationRate = Math.round((overview?.activationRate ?? 0) * 100);
  return (
    <Stack className="contentGrid" direction={{ md: "row", xs: "column" }} spacing={2}>
      <Card className="primaryPanel">
        <CardContent>
          <Typography variant="h6">用户词库状态</Typography>
          <Typography variant="h3">{activationRate}%</Typography>
          <Typography color="text.secondary">已掌握和巩固中词条占总词库比例。</Typography>
        </CardContent>
      </Card>
      <Card className="primaryPanel">
        <CardContent>
          <Typography variant="h6">可用词库</Typography>
          <List dense>
            {words.slice(0, 10).map((word) => (
              <ListItem key={word.wordId}>
                <ListItemText primary={`${word.word} ${word.phonetic ?? ""}`} secondary={word.meaningCn ?? word.meaningEn ?? "待补全释义"} />
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>
    </Stack>
  );
}

function DictionaryPanel(): JSX.Element {
  const [keyword, setKeyword] = useState("");
  const [rows, setRows] = useState<WordMeta[]>([]);
  const [selected, setSelected] = useState<WordMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(): Promise<void> {
    if (!keyword.trim()) {
      setError("请输入要查询的单词。");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await learningApi.wordMeta({ keyword: keyword.trim(), limit: 10, offset: 0 });
      setRows(response.items);
      setSelected(response.items[0] ?? null);
    } catch (caught) {
      setRows([]);
      setSelected(null);
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Stack spacing={2}>
      <Card className="primaryPanel">
        <CardContent>
          <Stack direction={{ md: "row", xs: "column" }} spacing={1} sx={{ alignItems: { md: "center", xs: "stretch" } }}>
            <TextField
              label="查询单词"
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void search();
              }}
              value={keyword}
            />
            <Button disabled={loading} onClick={() => void search()} variant="contained">查询</Button>
          </Stack>
          {loading ? <LinearProgress sx={{ mt: 2 }} /> : null}
          {error ? <Alert severity="warning" sx={{ mt: 2 }}>{error}</Alert> : null}
        </CardContent>
      </Card>
      {rows.length > 1 ? (
        <Card className="primaryPanel">
          <CardContent>
            <Typography variant="h6">匹配结果</Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", mt: 1 }}>
              {rows.map((meta) => (
                <Chip
                  clickable
                  color={selected?.wordMetaId === meta.wordMetaId ? "primary" : "default"}
                  key={meta.wordMetaId}
                  label={`${meta.word} · ${wordMetaPhoneticsText(meta) || meta.source}`}
                  onClick={() => setSelected(meta)}
                  variant={selected?.wordMetaId === meta.wordMetaId ? "filled" : "outlined"}
                />
              ))}
            </Stack>
          </CardContent>
        </Card>
      ) : null}
      {selected ? (
        <Card className="primaryPanel">
          <CardContent>
            <WordMetaDetail meta={selected} />
          </CardContent>
        </Card>
      ) : rows.length === 0 && !loading ? (
        <Alert severity="info">输入单词后可以查看音标、词性、英文释义、来源和原始 DictionaryAPI 元信息。</Alert>
      ) : null}
    </Stack>
  );
}

function CoursePanel({ courses, scenes, sentences }: { courses: Course[]; scenes: Scene[]; sentences: Sentence[] }): JSX.Element {
  return (
    <Stack className="contentGrid" direction={{ md: "row", xs: "column" }} spacing={2}>
      <Card className="primaryPanel">
        <CardContent>
          <Typography variant="h6">课程列表</Typography>
          <List dense>
            {courses.slice(0, 8).map((course) => (
              <ListItem key={course.courseId}>
                <ListItemText primary={course.title} secondary={`Level ${course.level ?? 1} · ${course.sentenceCount ?? 0} 句`} />
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>
      <Card className="primaryPanel">
        <CardContent>
          <Typography variant="h6">课程语料</Typography>
          <Typography color="text.secondary">已加载 {scenes.length} 个场景，{sentences.length} 条句子。</Typography>
          <List dense>
            {sentences.slice(0, 5).map((sentence) => (
              <ListItem key={sentence.sentenceId}>
                <ListItemText primary={sentence.sentenceText} secondary={(sentence.targetWords ?? []).join(", ")} />
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>
    </Stack>
  );
}

function ListenPanel({ onSubmit, sentences }: { onSubmit: (sentence: Sentence) => void; sentences: Sentence[] }): JSX.Element {
  const sentence = sentences[0];
  return (
    <Card className="primaryPanel">
      <CardContent>
        <Typography variant="h5">听读跟读</Typography>
        <Typography color="text.secondary">模式 A 慢速听读，模式 B 原速跟读，模式 C 目标短语复述。</Typography>
        <Typography sx={{ my: 2 }} variant="h6">{sentence?.sentenceText ?? "暂无已发布句子"}</Typography>
        <Stack direction="row" spacing={1}>
          <Button disabled={!sentence} startIcon={<HeadphonesIcon />} variant="outlined">播放</Button>
          <Button disabled={!sentence} onClick={() => sentence && onSubmit(sentence)} startIcon={<RepeatIcon />} variant="contained">提交跟读</Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

function ReportPanel({ courses, overview }: { courses: Course[]; overview: VocabularyOverview | null }): JSX.Element {
  return (
    <Card className="primaryPanel">
      <CardContent>
        <Typography variant="h5">课程报告</Typography>
        <Stack direction={{ md: "row", xs: "column" }} spacing={2} sx={{ mt: 2 }}>
          <Metric label="完成课程" value={String(courses.length)} />
          <Metric label="总词数" value={String(overview?.total ?? 0)} />
          <Metric label="已掌握词" value={String(overview?.green ?? 0)} />
        </Stack>
      </CardContent>
    </Card>
  );
}

function ProfilePanel({
  ensureUserSession,
  onResetUserSession,
  userSession,
}: {
  ensureUserSession: () => UserSession;
  onResetUserSession: () => void;
  userSession: UserSession | null;
}): JSX.Element {
  return (
    <Card className="primaryPanel">
      <CardContent>
        <Typography variant="h5">个人信息</Typography>
        <Typography color="text.secondary">学习端使用本地 session 作为开发身份，接入正式用户体系后替换为真实登录。</Typography>
        <Typography sx={{ my: 2 }}>{userSession?.sessionId ?? "尚未创建学习身份"}</Typography>
        <Stack direction="row" spacing={1}>
          <Button onClick={ensureUserSession} startIcon={<PersonIcon />} variant="contained">创建学习身份</Button>
          <Button onClick={onResetUserSession} variant="outlined">重新创建本地身份</Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

function AdminWorkspace({
  adminModule,
  adminSession,
  onChangeModule,
  onSessionChange,
}: {
  adminModule: AdminModule;
  adminSession: AdminSession | null;
  onChangeModule: (module: AdminModule) => void;
  onSessionChange: (session: AdminSession | null) => void;
}): JSX.Element {
  const navSections = adminModules.reduce<Record<AdminModuleMeta["category"], AdminModuleMeta[]>>(
    (sections, module) => ({
      ...sections,
      [module.category]: [...sections[module.category], module],
    }),
    { 内容生产: [], 词库: [] },
  );
  return (
    <Box component="main" className="adminLayout">
      <Box className="adminNav">
        <Box className="adminNavTitle">
          <Typography variant="overline">管理后台</Typography>
          <Typography color="text.secondary" variant="body2">内容与词库运营</Typography>
        </Box>
        {Object.entries(navSections).map(([category, modules]) => (
          <Box className="adminNavSection" key={category}>
            <Typography className="adminNavSectionTitle" variant="caption">{category}</Typography>
            <Stack spacing={0.5}>
              {modules.map((module) => (
                <Button
                  className={`adminNavButton${adminModule === module.key ? " isActive" : ""}`}
                  fullWidth
                  key={module.key}
                  onClick={() => onChangeModule(module.key)}
                  startIcon={module.icon}
                  variant="text"
                >
                  <Box component="span" className="adminNavButtonText">
                    <span>{module.label}</span>
                    <span>{module.summary}</span>
                  </Box>
                </Button>
              ))}
            </Stack>
          </Box>
        ))}
      </Box>
      <Box className="adminContent">
        {adminSession ? (
          <AdminModulePanel adminModule={adminModule} adminSession={adminSession} onSessionChange={onSessionChange} />
        ) : (
          <AdminLoginPanel onSessionChange={onSessionChange} />
        )}
      </Box>
    </Box>
  );
}

function AdminLoginPanel({ onSessionChange }: { onSessionChange: (session: AdminSession | null) => void }): JSX.Element {
  const [loginName, setLoginName] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState<string | null>(null);

  async function login(): Promise<void> {
    setError(null);
    try {
      const session = await adminApi.login(loginName, password);
      saveAdminSession(session);
      onSessionChange(session);
    } catch (caught) {
      setError(readableError(caught));
    }
  }

  return (
    <Card className="primaryPanel loginPanel">
      <CardContent>
        <Typography variant="h5">管理员登录</Typography>
        <Typography color="text.secondary">管理员不开放公开注册，由已有 super_admin 在 M1 创建和重置账号。</Typography>
        {error ? <Alert severity="warning">{error}</Alert> : null}
        <Stack spacing={2} sx={{ mt: 2 }}>
          <TextField label="登录名" onChange={(event) => setLoginName(event.target.value)} value={loginName} />
          <TextField label="密码" onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
          <Button onClick={login} startIcon={<LoginIcon />} variant="contained">登录</Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

function AdminModulePanel({
  adminModule,
  adminSession,
  onSessionChange,
}: {
  adminModule: AdminModule;
  adminSession: AdminSession;
  onSessionChange: (session: AdminSession | null) => void;
}): JSX.Element {
  const [items, setItems] = useState<JsonRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const moduleMeta = useMemo(() => adminModules.find((module) => module.key === adminModule) ?? defaultAdminModule, [adminModule]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await loadAdminItems(adminModule));
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  }, [adminModule]);

  useEffect(() => {
    void load();
  }, [load]);

  async function logout(): Promise<void> {
    try {
      await adminApi.logout();
    } catch {
      // Session may already be invalid; local cleanup is still required.
    }
    clearAdminSession();
    onSessionChange(null);
  }

  async function submitQuickCreate(body: JsonRecord): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      await quickCreate(adminModule, body);
      await load();
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Stack spacing={2}>
      <Box className="adminPageHeader">
        <Box>
          <Typography variant="h5">{moduleMeta.label}</Typography>
          <Typography color="text.secondary">{moduleMeta.summary}</Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Chip label={adminSession.displayName} />
          <Button onClick={logout} startIcon={<LogoutIcon />} variant="outlined">退出</Button>
        </Stack>
      </Box>
      {loading ? <LinearProgress /> : null}
      {error ? <Alert severity="warning">{error}</Alert> : null}
      {isContentAdminModule(adminModule) ? (
        <ContentAdminConsole module={adminModule} operatorName={adminSession.displayName} />
      ) : adminModule === "word-library" ? (
        <WordLibraryAdminPanel onError={setError} />
      ) : (
        <>
          <AdminQuickCreate module={adminModule} onSubmit={submitQuickCreate} />
          <AdminList items={items} loading={loading} module={adminModule} onRefresh={() => void load()} />
        </>
      )}
    </Stack>
  );
}

function WordLibraryAdminPanel({ onError }: { onError: (message: string | null) => void }): JSX.Element {
  const [wordLibraryTab, setWordLibraryTab] = useState<WordLibraryTab>(() =>
    window.location.hash.includes("/words") ? "words" : "subtlexus",
  );
  const [form, setForm] = useState<WordFormState>(emptyWordForm);
  const [editingWordId, setEditingWordId] = useState<string | null>(null);
  const [wordDialogOpen, setWordDialogOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [limit, setLimit] = useState("");
  const [importReason, setImportReason] = useState("");
  const [importResult, setImportResult] = useState<SubtlexusImportResult | null>(null);
  const [sourceFilters, setSourceFilters] = useState<SubtlexusFilterState>(emptySubtlexusFilters);
  const [sourceWords, setSourceWords] = useState<SubtlexusWord[]>([]);
  const [createFromSource, setCreateFromSource] = useState<CreateFromSubtlexusState>(emptyCreateFromSubtlexus);
  const [createResult, setCreateResult] = useState<JsonRecord | null>(null);
  const [wordFilters, setWordFilters] = useState<WordListFilterState>(emptyWordListFilters);
  const [words, setWords] = useState<WordEntry[]>([]);
  const [wordMetaFilters, setWordMetaFilters] = useState<WordMetaFilterState>(emptyWordMetaFilters);
  const [wordMetaRows, setWordMetaRows] = useState<WordMeta[]>([]);
  const [selectedWordMeta, setSelectedWordMeta] = useState<WordMeta | null>(null);
  const [wordMetaApplyReason, setWordMetaApplyReason] = useState("");
  const [selectedWordIds, setSelectedWordIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<BulkWordStatusState>(emptyBulkWordStatus);
  const [bulkPublishReason, setBulkPublishReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingSources, setLoadingSources] = useState(false);
  const [loadingWords, setLoadingWords] = useState(false);
  const [loadingWordMeta, setLoadingWordMeta] = useState(false);
  const selectedWords = useMemo(() => words.filter((word) => selectedWordIds.includes(word.wordId)), [selectedWordIds, words]);
  const allWordsSelected = words.length > 0 && words.every((word) => selectedWordIds.includes(word.wordId));
  const someWordsSelected = selectedWordIds.length > 0 && !allWordsSelected;
  const hasBulkChange = Boolean(bulkStatus.publishStatus || bulkStatus.reviewStatus || bulkStatus.audioStatus);
  const bulkPublishNeedsReason = Boolean(bulkStatus.publishStatus);
  const publishBlockedWords = useMemo(
    () => (bulkStatus.publishStatus === "published" ? selectedWords.filter((word) => wordPublishBlockReasons(word, bulkStatus).length > 0) : []),
    [bulkStatus, selectedWords],
  );

  const fetchSources = useCallback(
    async (filters: SubtlexusFilterState): Promise<void> => {
      setLoadingSources(true);
      onError(null);
      try {
        const response = await adminApi.subtlexusWords({
          importBatchId: filters.importBatchId,
          keyword: filters.keyword,
          limit: filters.limit ? Number(filters.limit) : 10,
          minLg10Wf: filters.minLg10Wf ? Number(filters.minLg10Wf) : undefined,
          offset: filters.offset ? Number(filters.offset) : 0,
          sortBy: filters.sortBy,
          sortOrder: filters.sortOrder,
        });
        setSourceWords(response.items);
      } catch (caught) {
        onError(readableError(caught));
      } finally {
        setLoadingSources(false);
      }
    },
    [onError],
  );

  const loadSources = useCallback(
    async (override?: Partial<SubtlexusFilterState>): Promise<void> => {
      const filters = { ...sourceFilters, ...override };
      if (override) setSourceFilters(filters);
      await fetchSources(filters);
    },
    [fetchSources, sourceFilters],
  );

  const fetchWords = useCallback(
    async (filters: WordListFilterState): Promise<void> => {
      setLoadingWords(true);
      onError(null);
      try {
	        const response = await adminApi.words({
          audioStatus: filters.audioStatus,
          hasAudio: filters.hasAudio ? true : undefined,
          hasMeaning: filters.hasMeaning ? true : undefined,
          isExcluded: filters.isExcluded ? true : undefined,
          keyword: filters.keyword,
          limit: filters.limit ? Number(filters.limit) : 10,
          minFrequencyCount: filters.minFrequencyCount ? Number(filters.minFrequencyCount) : undefined,
          minLg10wf: filters.minLg10wf ? Number(filters.minLg10wf) : undefined,
          offset: filters.offset ? Number(filters.offset) : 0,
          publishStatus: filters.publishStatus,
          reviewStatus: filters.reviewStatus,
          sortBy: filters.sortBy,
          sortOrder: filters.sortOrder,
        });
	        setWords(response.items);
	        setSelectedWordIds((current) => current.filter((wordId) => response.items.some((word) => word.wordId === wordId)));
      } catch (caught) {
        onError(readableError(caught));
      } finally {
        setLoadingWords(false);
      }
    },
    [onError],
  );

  const loadWords = useCallback(
    async (override?: Partial<WordListFilterState>): Promise<void> => {
      const filters = { ...wordFilters, ...override };
      if (override) setWordFilters(filters);
      await fetchWords(filters);
    },
    [fetchWords, wordFilters],
  );

  const fetchWordMeta = useCallback(
    async (filters: WordMetaFilterState): Promise<void> => {
      setLoadingWordMeta(true);
      onError(null);
      try {
        const response = await adminApi.wordMeta({
          importBatchId: filters.importBatchId,
          keyword: filters.keyword,
          limit: filters.limit ? Number(filters.limit) : 10,
          normalizedWord: filters.normalizedWord,
          offset: filters.offset ? Number(filters.offset) : 0,
          sortBy: filters.sortBy,
          sortOrder: filters.sortOrder,
          source: filters.source,
        });
        setWordMetaRows(response.items);
      } catch (caught) {
        onError(readableError(caught));
      } finally {
        setLoadingWordMeta(false);
      }
    },
    [onError],
  );

  const loadWordMeta = useCallback(
    async (override?: Partial<WordMetaFilterState>): Promise<void> => {
      const filters = { ...wordMetaFilters, ...override };
      if (override) setWordMetaFilters(filters);
      await fetchWordMeta(filters);
    },
    [fetchWordMeta, wordMetaFilters],
  );

  useEffect(() => {
    void fetchSources(emptySubtlexusFilters);
  }, [fetchSources]);

  useEffect(() => {
    void fetchWords(emptyWordListFilters);
  }, [fetchWords]);

  useEffect(() => {
    void fetchWordMeta(emptyWordMetaFilters);
  }, [fetchWordMeta]);

  function updateForm<K extends keyof WordFormState>(key: K, value: WordFormState[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateSourceFilter<K extends keyof SubtlexusFilterState>(key: K, value: SubtlexusFilterState[K]): void {
    setSourceFilters((current) => ({ ...current, [key]: value }));
  }

  function updateCreateFromSource<K extends keyof CreateFromSubtlexusState>(key: K, value: CreateFromSubtlexusState[K]): void {
    setCreateFromSource((current) => ({ ...current, [key]: value }));
  }

  function updateWordFilter<K extends keyof WordListFilterState>(key: K, value: WordListFilterState[K]): void {
    setWordFilters((current) => ({ ...current, [key]: value }));
  }

  function updateWordMetaFilter<K extends keyof WordMetaFilterState>(key: K, value: WordMetaFilterState[K]): void {
    setWordMetaFilters((current) => ({ ...current, [key]: value }));
  }

  function updateBulkStatus<K extends keyof BulkWordStatusState>(key: K, value: BulkWordStatusState[K]): void {
    setBulkStatus((current) => ({ ...current, [key]: value }));
  }

  function toggleWordSelection(wordId: string, checked: boolean): void {
    setSelectedWordIds((current) => {
      if (checked) return current.includes(wordId) ? current : [...current, wordId];
      return current.filter((currentId) => currentId !== wordId);
    });
  }

  function toggleAllWords(checked: boolean): void {
    setSelectedWordIds(checked ? words.map((word) => word.wordId) : []);
  }

  function sourcePageChange(nextPage: number): void {
    const limitValue = positiveInt(sourceFilters.limit, 10);
    void loadSources({ offset: String((nextPage - 1) * limitValue) });
  }

  function wordPageChange(nextPage: number): void {
    const limitValue = positiveInt(wordFilters.limit, 10);
    void loadWords({ offset: String((nextPage - 1) * limitValue) });
  }

  function wordMetaPageChange(nextPage: number): void {
    const limitValue = positiveInt(wordMetaFilters.limit, 10);
    void loadWordMeta({ offset: String((nextPage - 1) * limitValue) });
  }

  function openCreateWordDialog(): void {
    setEditingWordId(null);
    setForm(emptyWordForm);
    setWordDialogOpen(true);
  }

  function openEditWordDialog(word: WordEntry): void {
    setEditingWordId(word.wordId);
    setForm(wordToForm(word));
    setWordDialogOpen(true);
  }

  function resetForm(): void {
    setEditingWordId(null);
    setForm(emptyWordForm);
    setWordDialogOpen(false);
  }

  async function submitWord(): Promise<void> {
    setSubmitting(true);
    onError(null);
    try {
      const payload = wordFormToPayload(form);
      let updatedWord: WordEntry;
      if (editingWordId) {
        updatedWord = await adminApi.updateWord(editingWordId, payload);
      } else {
        updatedWord = await adminApi.createWord(payload);
      }
      if (form.publishStatus !== updatedWord.publishStatus) {
        await adminApi.updateWordPublish(updatedWord.wordId, form.publishStatus, form.reason);
      }
      resetForm();
      await loadWords();
    } catch (caught) {
      onError(readableError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  async function applyBulkStatus(): Promise<void> {
    if (selectedWords.length === 0 || !hasBulkChange) return;
    setSubmitting(true);
    onError(null);
    try {
      const updateOne = async (word: WordEntry): Promise<WordEntry> => {
        let updated = word;
        const patch: JsonRecord = {};
        if (bulkStatus.reviewStatus && bulkStatus.reviewStatus !== updated.reviewStatus) {
          patch.reviewStatus = bulkStatus.reviewStatus;
        }
        if (bulkStatus.audioStatus && bulkStatus.audioStatus !== updated.audioStatus) {
          patch.audioStatus = bulkStatus.audioStatus;
        }
        if (Object.keys(patch).length > 0) {
          updated = await adminApi.updateWord(updated.wordId, {
            ...patch,
            reason: "",
          });
        }
        if (bulkStatus.publishStatus && bulkStatus.publishStatus !== updated.publishStatus) {
          updated = await adminApi.updateWordPublish(updated.wordId, bulkStatus.publishStatus, bulkPublishReason.trim());
        }
        return updated;
      };
      const updatedWords = await selectedWords.reduce<Promise<WordEntry[]>>(
        async (previousUpdates, word) => [...(await previousUpdates), await updateOne(word)],
        Promise.resolve([]),
      );
      setWords((current) => current.map((word) => updatedWords.find((updated) => updated.wordId === word.wordId) ?? word));
      setBulkStatus(emptyBulkWordStatus);
      setBulkPublishReason("");
      setSelectedWordIds([]);
    } catch (caught) {
      onError(readableError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  async function applySelectedWordMeta(meta: WordMeta): Promise<void> {
    setSubmitting(true);
    onError(null);
    try {
      await adminApi.applyWordMeta(meta.wordMetaId, {
        createMissing: true,
        overwrite: false,
        reason: wordMetaApplyReason.trim() || `应用 ${meta.word} 的 DictionaryAPI 元信息`,
      });
      setSelectedWordMeta(null);
      setWordMetaApplyReason("");
      await loadWordMeta();
      await loadWords();
    } catch (caught) {
      onError(readableError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitImport(): Promise<void> {
    if (!file) {
      onError("请选择 .xls 或 .xlsx 文件。");
      return;
    }
    setSubmitting(true);
    onError(null);
    try {
      const result = await adminApi.importSubtlexus(file, {
        dryRun,
        limit: limit ? Number(limit) : null,
        reason: importReason,
      });
      setImportResult(result);
      if (result.importBatchId) {
        await loadSources({ importBatchId: result.importBatchId });
      }
      if (!dryRun) await loadWords();
    } catch (caught) {
      onError(readableError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitCreateFromSubtlexus(): Promise<void> {
    const specifiedWords = splitLines(createFromSource.words);
    if (!createFromSource.minLg10Wf && specifiedWords.length === 0) {
      onError("请填写最低 lg10Wf，或输入要生成的词。");
      return;
    }
    setSubmitting(true);
    onError(null);
    try {
      const result = await adminApi.createWordsFromSubtlexus({
        excludeExisting: createFromSource.excludeExisting,
        maxRows: createFromSource.maxRows ? Number(createFromSource.maxRows) : undefined,
        minLg10Wf: createFromSource.minLg10Wf ? Number(createFromSource.minLg10Wf) : undefined,
        reason: createFromSource.reason,
        words: specifiedWords.length ? specifiedWords : undefined,
      });
      setCreateResult({ ...result });
      await loadWords();
      setWordLibraryTab("words");
    } catch (caught) {
      onError(readableError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Stack spacing={2}>
      <Card className="primaryPanel wordLibraryTabsPanel">
        <CardContent>
          <Tabs
            onChange={(_, value: WordLibraryTab) => setWordLibraryTab(value)}
            value={wordLibraryTab}
            variant="scrollable"
          >
            <Tab label="SUBTLEXus 词频" value="subtlexus" />
            <Tab label="单词管理" value="words" />
            <Tab label="Word Meta" value="wordMeta" />
          </Tabs>
        </CardContent>
      </Card>

      {wordLibraryTab === "subtlexus" ? (
        <>
          <Card className="primaryPanel">
            <CardContent>
          <Typography variant="h6">SUBTLEXus 词频表导入</Typography>
          <Typography color="text.secondary">先把 Excel 导入来源词表；导入结果里的批次 ID 会自动用于筛选来源词。</Typography>
          <Box className="importControlGrid">
            <Button component="label" startIcon={<UploadFileIcon />} variant="outlined">
              选择文件
              <input
                hidden
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                type="file"
                accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              />
            </Button>
            <TextField disabled label="文件" value={file?.name ?? ""} />
            <TextField label="限制行数" onChange={(event) => setLimit(event.target.value)} type="number" value={limit} />
            <TextField label="原因" onChange={(event) => setImportReason(event.target.value)} value={importReason} />
            <FormControlLabel className="noWrapControl" control={<Checkbox checked={dryRun} onChange={(event) => setDryRun(event.target.checked)} />} label="只预检" />
            <Button disabled={submitting} onClick={submitImport} startIcon={<UploadFileIcon />} variant="contained">
              导入
            </Button>
          </Box>
          {importResult ? (
            <Box className="resultBlock">
              <Box className="resultMetricGrid">
                <Metric label="批次 ID" value={importResult.importBatchId} />
                <Metric label="可导入行" value={String(importResult.importableRows)} />
                <Metric label="新增/更新" value={`${importResult.created} / ${importResult.updated}`} />
                <Metric label="跳过/总行" value={`${importResult.skippedRows} / ${importResult.totalRows}`} />
              </Box>
              <Box className="jsonResult">
                <Typography variant="subtitle2">原始返回</Typography>
                <Typography component="pre">{JSON.stringify(importResult, null, 2)}</Typography>
              </Box>
            </Box>
          ) : null}
            </CardContent>
          </Card>

          <Card className="primaryPanel">
            <CardContent>
          <Stack direction={{ md: "row", xs: "column" }} spacing={2} sx={{ alignItems: { md: "center", xs: "flex-start" }, justifyContent: "space-between" }}>
            <Box>
              <Typography variant="h6">SUBTLEXus 来源词</Typography>
              <Typography color="text.secondary">对应 GET /admin/word-library/subtlexus-words，确认导入批次和频率字段后再生成学习词条。</Typography>
            </Box>
            <Button disabled={loadingSources} onClick={() => void loadSources()} size="small" variant="outlined">查询 / 刷新</Button>
          </Stack>
          <Box className="filterGrid">
            <TextField label="importBatchId" onChange={(event) => updateSourceFilter("importBatchId", event.target.value)} value={sourceFilters.importBatchId} />
            <TextField label="keyword" onChange={(event) => updateSourceFilter("keyword", event.target.value)} value={sourceFilters.keyword} />
            <TextField label="minLg10Wf" onChange={(event) => updateSourceFilter("minLg10Wf", event.target.value)} type="number" value={sourceFilters.minLg10Wf} />
            <TextField label="limit" onChange={(event) => updateSourceFilter("limit", event.target.value)} type="number" value={sourceFilters.limit} />
            <TextField label="offset" onChange={(event) => updateSourceFilter("offset", event.target.value)} type="number" value={sourceFilters.offset} />
            <TextField label="sortBy" onChange={(event) => updateSourceFilter("sortBy", event.target.value as SubtlexusFilterState["sortBy"])} select value={sourceFilters.sortBy}>
              <MenuItem value="createdAt">createdAt</MenuItem>
              <MenuItem value="word">word</MenuItem>
              <MenuItem value="freqCount">freqCount</MenuItem>
              <MenuItem value="cdCount">cdCount</MenuItem>
              <MenuItem value="lg10Wf">lg10Wf</MenuItem>
              <MenuItem value="lg10Cd">lg10Cd</MenuItem>
            </TextField>
            <TextField label="sortOrder" onChange={(event) => updateSourceFilter("sortOrder", event.target.value as "asc" | "desc")} select value={sourceFilters.sortOrder}>
              <MenuItem value="desc">desc</MenuItem>
              <MenuItem value="asc">asc</MenuItem>
            </TextField>
            <Button disabled={loadingSources} onClick={() => void loadSources({ offset: "0" })} variant="contained">查询 / 刷新</Button>
          </Box>
          {loadingSources ? <LinearProgress sx={{ mt: 2 }} /> : null}
          <Box className="tableScroller">
            <Table padding="none" size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{headerTip("Word", "词形；若大写开头更常见，原表会以大写开头。")}</TableCell>
                  <TableCell>{headerTip("FREQcount", "在 5100 万词语料中出现的总次数。")}</TableCell>
                  <TableCell>{headerTip("CDcount", "出现过该词的影片数，最大 8,388。")}</TableCell>
                  <TableCell>{headerTip("FREQlow", "以小写开头出现的总次数，用于区分大小写刺激材料。")}</TableCell>
                  <TableCell>{headerTip("CDlow", "以小写开头出现过该词的影片数。")}</TableCell>
                  <TableCell>{headerTip("SUBTLWF", "每百万词频率，跨语料规模可比，论文中优先使用。")}</TableCell>
                  <TableCell>{headerTip("Lg10WF", "log10(FREQcount+1)，四位精度；约 1/2/3/4/5 对应 SUBTLWF 0.2/2/20/200/2000。")}</TableCell>
                  <TableCell>{headerTip("SUBTLCD", "出现该词的影片百分比，两位精度。")}</TableCell>
                  <TableCell>{headerTip("Lg10CD", "log10(CDcount+1)，匹配词频时推荐；约 0.95/1.93/2.92/3.92 对应 SUBTLCD 0.1/1/10/100。")}</TableCell>
                  <TableCell>{headerTip("Batch", "本次导入批次 ID。")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sourceWords.map((item) => (
                  <TableRow key={item.subtlexusWordId} hover>
                    <TableCell>{item.word}</TableCell>
                    <TableCell>{item.freqCount ?? ""}</TableCell>
                    <TableCell>{item.cdCount ?? ""}</TableCell>
                    <TableCell>{item.freqLow ?? ""}</TableCell>
                    <TableCell>{item.cdLow ?? ""}</TableCell>
                    <TableCell>{item.subtlWf ?? ""}</TableCell>
                    <TableCell>{item.lg10Wf ?? ""}</TableCell>
                    <TableCell>{item.subtlCd ?? ""}</TableCell>
                    <TableCell>{item.lg10Cd ?? ""}</TableCell>
                    <TableCell>
                      <Tooltip arrow title={item.importBatchId}>
                        <Box component="span">{shortId(item.importBatchId)}</Box>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {sourceWords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10}>暂无来源词。</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </Box>
          <PaginationControls
            itemCount={sourceWords.length}
            limit={positiveInt(sourceFilters.limit, 10)}
            loading={loadingSources}
            offset={positiveInt(sourceFilters.offset, 0)}
            onPageChange={sourcePageChange}
          />
            </CardContent>
          </Card>

          <Card className="primaryPanel">
            <CardContent>
          <Typography variant="h6">从 SUBTLEXus 生成学习词条</Typography>
          <Typography color="text.secondary">对应 POST /admin/word-library/words/from-subtlexus，可按最低 lg10Wf 批量生成，也可指定词表。</Typography>
          <Box className="createFromSourceGrid">
            <TextField label="minLg10Wf" onChange={(event) => updateCreateFromSource("minLg10Wf", event.target.value)} type="number" value={createFromSource.minLg10Wf} />
            <TextField label="maxRows" onChange={(event) => updateCreateFromSource("maxRows", event.target.value)} type="number" value={createFromSource.maxRows} />
            <TextField label="reason" onChange={(event) => updateCreateFromSource("reason", event.target.value)} value={createFromSource.reason} />
            <FormControlLabel className="noWrapControl" control={<Checkbox checked={createFromSource.excludeExisting} onChange={(event) => updateCreateFromSource("excludeExisting", event.target.checked)} />} label="排除已存在词条" />
            <TextField
              label="指定 words，可换行或逗号分隔"
              minRows={3}
              multiline
              onChange={(event) => updateCreateFromSource("words", event.target.value)}
              value={createFromSource.words}
            />
            <Button disabled={submitting} onClick={submitCreateFromSubtlexus} startIcon={<SaveIcon />} variant="contained">生成学习词条</Button>
          </Box>
          {createResult ? (
            <Box className="jsonResult">
              <Typography variant="subtitle2">生成结果</Typography>
              <Typography component="pre">{JSON.stringify(createResult, null, 2)}</Typography>
            </Box>
          ) : null}
            </CardContent>
          </Card>
        </>
      ) : null}

      {wordLibraryTab === "words" ? (
        <Card className="primaryPanel">
            <CardContent>
          <Stack direction={{ md: "row", xs: "column" }} spacing={2} sx={{ alignItems: { md: "center", xs: "flex-start" }, justifyContent: "space-between" }}>
            <Box>
              <Typography variant="h6">学习词条列表</Typography>
              <Typography color="text.secondary">对应 GET /admin/word-library/words，覆盖状态、音频、释义、频率、标签和排除字段。</Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button disabled={loadingWords} onClick={() => void loadWords()} size="small" variant="outlined">查询 / 刷新</Button>
              <Button disabled={submitting} onClick={openCreateWordDialog} size="small" startIcon={<SaveIcon />} variant="contained">创建词条</Button>
            </Stack>
          </Stack>
          <Box className="filterGrid">
            <TextField label="keyword" onChange={(event) => updateWordFilter("keyword", event.target.value)} value={wordFilters.keyword} />
            <TextField label="publishStatus" onChange={(event) => updateWordFilter("publishStatus", event.target.value as WordListFilterState["publishStatus"])} select value={wordFilters.publishStatus}>
              <MenuItem value="">全部</MenuItem>
              <MenuItem value="draft">draft</MenuItem>
              <MenuItem value="published">published</MenuItem>
              <MenuItem value="archived">archived</MenuItem>
            </TextField>
            <TextField label="reviewStatus" onChange={(event) => updateWordFilter("reviewStatus", event.target.value as WordListFilterState["reviewStatus"])} select value={wordFilters.reviewStatus}>
              <MenuItem value="">全部</MenuItem>
              <MenuItem value="pending_review">pending_review</MenuItem>
              <MenuItem value="approved">approved</MenuItem>
              <MenuItem value="rejected">rejected</MenuItem>
            </TextField>
            <TextField label="audioStatus" onChange={(event) => updateWordFilter("audioStatus", event.target.value as WordListFilterState["audioStatus"])} select value={wordFilters.audioStatus}>
              <MenuItem value="">全部</MenuItem>
              <MenuItem value="missing">missing</MenuItem>
              <MenuItem value="ready">ready</MenuItem>
              <MenuItem value="failed">failed</MenuItem>
            </TextField>
            <TextField label="minFrequencyCount" onChange={(event) => updateWordFilter("minFrequencyCount", event.target.value)} type="number" value={wordFilters.minFrequencyCount} />
            <TextField label="minLg10wf" onChange={(event) => updateWordFilter("minLg10wf", event.target.value)} type="number" value={wordFilters.minLg10wf} />
            <TextField label="limit" onChange={(event) => updateWordFilter("limit", event.target.value)} type="number" value={wordFilters.limit} />
            <TextField label="offset" onChange={(event) => updateWordFilter("offset", event.target.value)} type="number" value={wordFilters.offset} />
            <TextField label="sortBy" onChange={(event) => updateWordFilter("sortBy", event.target.value as WordListFilterState["sortBy"])} select value={wordFilters.sortBy}>
              <MenuItem value="createdAt">createdAt</MenuItem>
              <MenuItem value="updatedAt">updatedAt</MenuItem>
              <MenuItem value="word">word</MenuItem>
              <MenuItem value="difficultyLevel">difficultyLevel</MenuItem>
              <MenuItem value="lg10wf">lg10wf</MenuItem>
              <MenuItem value="frequencyCount">frequencyCount</MenuItem>
            </TextField>
            <TextField label="sortOrder" onChange={(event) => updateWordFilter("sortOrder", event.target.value as "asc" | "desc")} select value={wordFilters.sortOrder}>
              <MenuItem value="desc">desc</MenuItem>
              <MenuItem value="asc">asc</MenuItem>
            </TextField>
            <FormControlLabel className="noWrapControl" control={<Checkbox checked={wordFilters.hasMeaning} onChange={(event) => updateWordFilter("hasMeaning", event.target.checked)} />} label="有释义" />
            <FormControlLabel className="noWrapControl" control={<Checkbox checked={wordFilters.hasAudio} onChange={(event) => updateWordFilter("hasAudio", event.target.checked)} />} label="有音频" />
            <FormControlLabel className="noWrapControl" control={<Checkbox checked={wordFilters.isExcluded} onChange={(event) => updateWordFilter("isExcluded", event.target.checked)} />} label="仅排除词" />
            <Button disabled={loadingWords} onClick={() => void loadWords({ offset: "0" })} variant="contained">查询 / 刷新</Button>
	          </Box>
	          {loadingWords ? <LinearProgress sx={{ mt: 2 }} /> : null}
          <Stack spacing={1.25} sx={{ my: 2 }}>
            <Stack direction={{ md: "row", xs: "column" }} spacing={1} sx={{ alignItems: { md: "center", xs: "stretch" } }}>
              <Chip label={`已选 ${selectedWords.length} 条`} size="small" />
              <TextField
                label="批量审核"
                onChange={(event) => updateBulkStatus("reviewStatus", event.target.value as BulkWordStatusState["reviewStatus"])}
                select
                size="small"
                sx={{ width: { md: 140, xs: "100%" } }}
                value={bulkStatus.reviewStatus}
              >
                <MenuItem value="">不修改</MenuItem>
                <MenuItem value="pending_review">待审</MenuItem>
                <MenuItem value="approved">通过</MenuItem>
                <MenuItem value="rejected">拒绝</MenuItem>
              </TextField>
              <TextField
                label="批量音频"
                onChange={(event) => updateBulkStatus("audioStatus", event.target.value as BulkWordStatusState["audioStatus"])}
                select
                size="small"
                sx={{ width: { md: 140, xs: "100%" } }}
                value={bulkStatus.audioStatus}
              >
                <MenuItem value="">不修改</MenuItem>
                <MenuItem value="missing">缺失</MenuItem>
                <MenuItem value="ready">就绪</MenuItem>
                <MenuItem value="failed">失败</MenuItem>
              </TextField>
              <TextField
                label="批量发布"
                onChange={(event) => updateBulkStatus("publishStatus", event.target.value as BulkWordStatusState["publishStatus"])}
                select
                size="small"
                sx={{ width: { md: 140, xs: "100%" } }}
                value={bulkStatus.publishStatus}
              >
                <MenuItem value="">不修改</MenuItem>
                <MenuItem value="draft">草稿</MenuItem>
                <MenuItem value="published">发布</MenuItem>
                <MenuItem value="archived">归档</MenuItem>
              </TextField>
              <TextField
                disabled={!bulkStatus.publishStatus}
                label="发布原因"
                onChange={(event) => setBulkPublishReason(event.target.value)}
                placeholder="必填"
                size="small"
                sx={{ width: { md: 220, xs: "100%" } }}
                value={bulkPublishReason}
              />
              <Button
                disabled={submitting || selectedWords.length === 0 || !hasBulkChange || publishBlockedWords.length > 0 || (bulkPublishNeedsReason && !bulkPublishReason.trim())}
                onClick={() => void applyBulkStatus()}
                size="small"
                variant="contained"
              >
                批量应用
              </Button>
              <Button disabled={submitting || selectedWords.length === 0} onClick={() => setSelectedWordIds([])} size="small" variant="outlined">
                清除选择
              </Button>
            </Stack>
            {publishBlockedWords.length > 0 ? (
              <Alert severity="warning">
                选中的 {publishBlockedWords.length} 个词暂不能发布。发布要求：审核通过、音频就绪且有音频 URL、未排除，并补齐中英文释义、FREQ/CD、Lg10WF/Lg10CD。
              </Alert>
            ) : (
              <Alert severity="info">
                审核决定词条内容是否可信；音频表示是否可用于听力练习；发布决定学习端和激活计划是否能使用该词。未选中的状态不会被修改。
              </Alert>
            )}
          </Stack>
	          <Box className="tableScroller">
	            <Table padding="none" size="small">
	              <TableHead>
	                <TableRow>
	                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={allWordsSelected}
                      disabled={words.length === 0 || submitting}
                      indeterminate={someWordsSelected}
                      onChange={(event) => toggleAllWords(event.target.checked)}
                      size="small"
                    />
	                  </TableCell>
                  <TableCell>资料</TableCell>
		                  <TableCell>{headerTip("Word", "词条展示词形；大小写保留来源词表或人工录入结果。")}</TableCell>
                  <TableCell>{headerTip("Lemma", "归一化词元，用于匹配、去重和学习记录关联。")}</TableCell>
                  <TableCell>释义</TableCell>
                  <TableCell>{headerTip("FREQ/CD", "FREQcount 为语料出现次数；CDcount 为出现过该词的影片数。")}</TableCell>
                  <TableCell>{headerTip("SUBTLEX", "SUBTLWF 为每百万词频率；Lg10WF 为 log10(FREQcount+1)。")}</TableCell>
                  <TableCell>状态</TableCell>
                  <TableCell>标签/排除</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {words.map((word) => (
                  <TableRow key={word.wordId} hover>
	                    <TableCell>
	                      <Checkbox
                        checked={selectedWordIds.includes(word.wordId)}
                        disabled={submitting}
                        onChange={(event) => toggleWordSelection(word.wordId, event.target.checked)}
                        size="small"
	                      />
	                    </TableCell>
                    <TableCell><Button onClick={() => openEditWordDialog(word)} size="small">编辑资料</Button></TableCell>
	                    <TableCell>{word.word}</TableCell>
                    <TableCell>{word.lemma}</TableCell>
                    <TableCell>{word.meaningCn ?? word.meaningEn ?? ""}</TableCell>
                    <TableCell>{word.frequencyCount ?? ""} / {word.cdCount ?? ""}</TableCell>
                    <TableCell>{word.subtlwf ?? ""} · {word.lg10wf ?? ""}</TableCell>
                    <TableCell>{word.publishStatus ?? ""} · {word.reviewStatus ?? ""} · {word.audioStatus ?? ""}</TableCell>
                    <TableCell>{[...(word.levelTags ?? []), ...(word.sceneTags ?? [])].join(", ")}{word.isExcluded ? " · excluded" : ""}</TableCell>
                  </TableRow>
                ))}
	                {words.length === 0 ? (
	                  <TableRow>
	                    <TableCell colSpan={9}>暂无词条。</TableCell>
	                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </Box>
          <PaginationControls
            itemCount={words.length}
            limit={positiveInt(wordFilters.limit, 10)}
            loading={loadingWords}
            offset={positiveInt(wordFilters.offset, 0)}
            onPageChange={wordPageChange}
          />
            </CardContent>
          </Card>
      ) : null}
      {wordLibraryTab === "wordMeta" ? (
        <Card className="primaryPanel">
          <CardContent>
            <Stack direction={{ md: "row", xs: "column" }} spacing={2} sx={{ alignItems: { md: "center", xs: "flex-start" }, justifyContent: "space-between" }}>
              <Box>
                <Typography variant="h6">DictionaryAPI 元信息</Typography>
                <Typography color="text.secondary">对应 GET /admin/word-library/word-meta，保存音标、释义结构、派生字段、来源和原始 payload。</Typography>
              </Box>
              <Button disabled={loadingWordMeta} onClick={() => void loadWordMeta()} size="small" variant="outlined">查询 / 刷新</Button>
            </Stack>
            <Box className="filterGrid">
              <TextField label="keyword" onChange={(event) => updateWordMetaFilter("keyword", event.target.value)} value={wordMetaFilters.keyword} />
              <TextField label="normalizedWord" onChange={(event) => updateWordMetaFilter("normalizedWord", event.target.value)} value={wordMetaFilters.normalizedWord} />
              <TextField label="source" onChange={(event) => updateWordMetaFilter("source", event.target.value)} value={wordMetaFilters.source} />
              <TextField label="importBatchId" onChange={(event) => updateWordMetaFilter("importBatchId", event.target.value)} value={wordMetaFilters.importBatchId} />
              <TextField label="limit" onChange={(event) => updateWordMetaFilter("limit", event.target.value)} type="number" value={wordMetaFilters.limit} />
              <TextField label="offset" onChange={(event) => updateWordMetaFilter("offset", event.target.value)} type="number" value={wordMetaFilters.offset} />
              <TextField label="sortBy" onChange={(event) => updateWordMetaFilter("sortBy", event.target.value as WordMetaFilterState["sortBy"])} select value={wordMetaFilters.sortBy}>
                <MenuItem value="createdAt">createdAt</MenuItem>
                <MenuItem value="updatedAt">updatedAt</MenuItem>
                <MenuItem value="word">word</MenuItem>
              </TextField>
              <TextField label="sortOrder" onChange={(event) => updateWordMetaFilter("sortOrder", event.target.value as "asc" | "desc")} select value={wordMetaFilters.sortOrder}>
                <MenuItem value="desc">desc</MenuItem>
                <MenuItem value="asc">asc</MenuItem>
              </TextField>
              <Button disabled={loadingWordMeta} onClick={() => void loadWordMeta({ offset: "0" })} variant="contained">查询 / 刷新</Button>
            </Box>
            {loadingWordMeta ? <LinearProgress sx={{ mt: 2 }} /> : null}
            <WordMetaTable onApply={setSelectedWordMeta} rows={wordMetaRows} />
            <PaginationControls
              itemCount={wordMetaRows.length}
              limit={positiveInt(wordMetaFilters.limit, 10)}
              loading={loadingWordMeta}
              offset={positiveInt(wordMetaFilters.offset, 0)}
              onPageChange={wordMetaPageChange}
            />
          </CardContent>
        </Card>
      ) : null}
      <Dialog fullWidth maxWidth="md" onClose={() => !submitting && resetForm()} open={wordDialogOpen}>
        <DialogTitle>{editingWordId ? "编辑词条资料" : "创建词条"}</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            发布前需补齐中英文释义、音频 URL、音频状态、频率字段，并确保审核通过且未排除。
          </Alert>
          <Box className="wordFormGrid">
            <TextField label="word" onChange={(event) => updateForm("word", event.target.value)} required value={form.word} />
            <TextField label="lemma" onChange={(event) => updateForm("lemma", event.target.value)} value={form.lemma} />
            <TextField label="phonetic" onChange={(event) => updateForm("phonetic", event.target.value)} value={form.phonetic} />
            <TextField label="partOfSpeech" onChange={(event) => updateForm("partOfSpeech", event.target.value)} value={form.partOfSpeech} />
            <TextField label="meaningCn" onChange={(event) => updateForm("meaningCn", event.target.value)} required value={form.meaningCn} />
            <TextField label="meaningEn" onChange={(event) => updateForm("meaningEn", event.target.value)} required value={form.meaningEn} />
            <TextField label="audioUrl" onChange={(event) => updateForm("audioUrl", event.target.value)} required value={form.audioUrl} />
            <TextField label="audioStatus" onChange={(event) => updateForm("audioStatus", event.target.value as WordFormState["audioStatus"])} select value={form.audioStatus}>
              <MenuItem value="missing">missing</MenuItem>
              <MenuItem value="ready">ready</MenuItem>
              <MenuItem value="failed">failed</MenuItem>
            </TextField>
            <TextField label="reviewStatus" onChange={(event) => updateForm("reviewStatus", event.target.value as WordFormState["reviewStatus"])} select value={form.reviewStatus}>
              <MenuItem value="pending_review">pending_review</MenuItem>
              <MenuItem value="approved">approved</MenuItem>
              <MenuItem value="rejected">rejected</MenuItem>
            </TextField>
            <TextField label="publishStatus" onChange={(event) => updateForm("publishStatus", event.target.value as WordFormState["publishStatus"])} select value={form.publishStatus}>
              <MenuItem value="draft">draft</MenuItem>
              <MenuItem value="published">published</MenuItem>
              <MenuItem value="archived">archived</MenuItem>
            </TextField>
            <TextField label="frequencyCount" onChange={(event) => updateForm("frequencyCount", event.target.value)} required type="number" value={form.frequencyCount} />
            <TextField label="cdCount" onChange={(event) => updateForm("cdCount", event.target.value)} required type="number" value={form.cdCount} />
            <TextField label="lg10wf" onChange={(event) => updateForm("lg10wf", event.target.value)} required value={form.lg10wf} />
            <TextField label="lg10cd" onChange={(event) => updateForm("lg10cd", event.target.value)} required value={form.lg10cd} />
            <TextField label="difficultyLevel" onChange={(event) => updateForm("difficultyLevel", event.target.value)} type="number" value={form.difficultyLevel} />
            <TextField label="frequencyLow" onChange={(event) => updateForm("frequencyLow", event.target.value)} type="number" value={form.frequencyLow} />
            <TextField label="cdLow" onChange={(event) => updateForm("cdLow", event.target.value)} type="number" value={form.cdLow} />
            <TextField label="subtlwf" onChange={(event) => updateForm("subtlwf", event.target.value)} value={form.subtlwf} />
            <TextField label="subtlcd" onChange={(event) => updateForm("subtlcd", event.target.value)} value={form.subtlcd} />
            <TextField label="levelTags，逗号分隔" onChange={(event) => updateForm("levelTags", event.target.value)} value={form.levelTags} />
            <TextField label="sceneTags，逗号分隔" onChange={(event) => updateForm("sceneTags", event.target.value)} value={form.sceneTags} />
            <TextField label="commonCollocations，逗号分隔" onChange={(event) => updateForm("commonCollocations", event.target.value)} value={form.commonCollocations} />
            <TextField label="hearingTrap" onChange={(event) => updateForm("hearingTrap", event.target.value)} value={form.hearingTrap} />
            <TextField label="distractors.pronunciation" onChange={(event) => updateForm("pronunciationDistractors", event.target.value)} value={form.pronunciationDistractors} />
            <TextField label="distractors.meaning" onChange={(event) => updateForm("meaningDistractors", event.target.value)} value={form.meaningDistractors} />
            <TextField label="distractors.difficulty" onChange={(event) => updateForm("difficultyDistractors", event.target.value)} value={form.difficultyDistractors} />
            <TextField label="exclusionReason" onChange={(event) => updateForm("exclusionReason", event.target.value)} value={form.exclusionReason} />
            <TextField label="reason" onChange={(event) => updateForm("reason", event.target.value)} value={form.reason} />
            <FormControlLabel className="noWrapControl" control={<Checkbox checked={form.isExcluded} onChange={(event) => updateForm("isExcluded", event.target.checked)} />} label="isExcluded" />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button disabled={submitting} onClick={resetForm} variant="outlined">取消</Button>
          <Button disabled={submitting || !form.word} onClick={() => void submitWord()} startIcon={<SaveIcon />} variant="contained">
            {editingWordId ? "保存资料" : "创建词条"}
          </Button>
        </DialogActions>
      </Dialog>
      {selectedWordMeta ? (
        <Dialog fullWidth maxWidth="md" onClose={() => !submitting && setSelectedWordMeta(null)} open>
          <DialogTitle>应用 Word Meta 到单词</DialogTitle>
          <DialogContent>
            <WordMetaDetail meta={selectedWordMeta} />
            <TextField
              fullWidth
              label="应用原因"
              onChange={(event) => setWordMetaApplyReason(event.target.value)}
              sx={{ mt: 2 }}
              value={wordMetaApplyReason}
            />
          </DialogContent>
          <DialogActions>
            <Button disabled={submitting} onClick={() => setSelectedWordMeta(null)} variant="outlined">取消</Button>
            <Button disabled={submitting} onClick={() => void applySelectedWordMeta(selectedWordMeta)} variant="contained">应用</Button>
          </DialogActions>
        </Dialog>
      ) : null}
    </Stack>
  );
}

function HeaderTip({ label, tip }: { label: string; tip: string }): JSX.Element {
  return (
    <Tooltip arrow title={tip}>
      <Box className="tableHeaderTip" component="span">{label}</Box>
    </Tooltip>
  );
}

function headerTip(label: string, tip: string): JSX.Element {
  return <HeaderTip label={label} tip={tip} />;
}

function WordMetaTable({ onApply, rows }: { onApply: (meta: WordMeta) => void; rows: WordMeta[] }): JSX.Element {
  return (
    <Box className="tableScroller">
      <Table padding="none" size="small">
        <TableHead>
          <TableRow>
            <TableCell>Word</TableCell>
            <TableCell>音标</TableCell>
            <TableCell>词性</TableCell>
            <TableCell>来源</TableCell>
            <TableCell>关联</TableCell>
            <TableCell>操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((meta) => (
            <TableRow hover key={meta.wordMetaId}>
              <TableCell>
                <Typography>{meta.word}</Typography>
              </TableCell>
              <TableCell>{wordMetaPhoneticsText(meta)}</TableCell>
              <TableCell>{wordMetaPartsOfSpeechText(meta)}</TableCell>
              <TableCell>{meta.source}{meta.licenseName ? ` · ${meta.licenseName}` : ""}</TableCell>
              <TableCell>{meta.wordId ? shortId(meta.wordId) : "未关联"}</TableCell>
              <TableCell><Button onClick={() => onApply(meta)} size="small">查看 / 应用</Button></TableCell>
            </TableRow>
          ))}
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6}>暂无 Word Meta。</TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </Box>
  );
}

function WordMetaDetail({ meta }: { meta: WordMeta }): JSX.Element {
  const entry = wordMetaDictionaryEntry(meta);
  const phonetics = wordMetaPhoneticItems(meta);
  return (
    <Box className="dictionaryEntry">
      <Box className="dictionaryHero">
        <Box>
          <Typography className="dictionaryWord" component="h2">{entry.word || meta.word}</Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", mt: 1 }}>
            {phonetics.map((item) => item.text).filter(Boolean).slice(0, 3).map((text) => <Chip className="phoneticChip" key={text} label={text} />)}
          </Stack>
        </Box>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", justifyContent: { md: "flex-end", xs: "flex-start" } }}>
          {phonetics.flatMap((item) => (item.audio ? [item.audio] : [])).slice(0, 2).map((audio) => <PronunciationPlayer audio={audio} key={audio} />)}
        </Stack>
      </Box>

      <Box className="dictionaryBody singleColumn">
        <Box className="dictionaryMain">
          {entry.meanings.map((meaning) => (
            <Box className="dictionaryMeaning" key={`${meta.wordMetaId}-${meaning.partOfSpeech}-${meaning.definitions.map((definition) => definition.definition).join("|").slice(0, 80)}`}>
              <Typography className="partOfSpeech">{meaning.partOfSpeech || "meaning"}</Typography>
              <Stack spacing={1.5}>
                {meaning.definitions.map((definition, index) => (
                  <Box className="definitionBlock" key={`${definition.definition}-${definition.example ?? ""}`}>
                    <Typography className="definitionNumber">{index + 1}</Typography>
                    <Box>
                      <Typography>{definition.definition}</Typography>
                      {definition.example ? <Typography className="exampleSentence">{definition.example}</Typography> : null}
                      <WordRelationChips label="同义词" values={[...meaning.synonyms, ...definition.synonyms]} />
                      <WordRelationChips label="反义词" values={[...meaning.antonyms, ...definition.antonyms]} />
                    </Box>
                  </Box>
                ))}
              </Stack>
            </Box>
          ))}
          {entry.meanings.length === 0 ? <Alert severity="info">暂无可展示的释义结构。</Alert> : null}
        </Box>

      </Box>
    </Box>
  );
}

function PronunciationPlayer({ audio, compact }: { audio: string; compact?: boolean }): JSX.Element {
  return (
    <Box className={compact ? "pronunciationPlayer isCompact" : "pronunciationPlayer"}>
      <audio aria-label="发音播放器" controls preload="none" src={audio} />
    </Box>
  );
}

function WordRelationChips({ label, values }: { label: string; values: string[] }): JSX.Element | null {
  const uniqueValues = [...new Set(values.filter(Boolean))].slice(0, 8);
  if (uniqueValues.length === 0) return null;
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", flexWrap: "wrap", mt: 0.75 }}>
      <Typography color="text.secondary" variant="caption">{label}</Typography>
      {uniqueValues.map((value) => <Chip key={`${label}-${value}`} label={value} size="small" variant="outlined" />)}
    </Stack>
  );
}

function PaginationControls({
  canGoNext,
  itemCount,
  limit,
  loading,
  offset,
  onPageChange,
}: {
  canGoNext?: boolean;
  itemCount: number;
  limit: number;
  loading: boolean;
  offset: number;
  onPageChange: (page: number) => void;
}): JSX.Element {
  const page = Math.floor(offset / limit) + 1;
  const nextEnabled = canGoNext ?? itemCount >= limit;
  const [jumpPage, setJumpPage] = useState(String(page));

  useEffect(() => {
    setJumpPage(String(page));
  }, [page]);

  function jump(): void {
    const nextPage = positiveInt(jumpPage, page);
    onPageChange(Math.max(1, nextPage));
  }

  return (
    <Box className="paginationControls">
      <Typography color="text.secondary" variant="body2">
        第 {page} 页 · 当前 {itemCount} 条 · 每页 {limit} 条
      </Typography>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
        <Button disabled={loading || page <= 1} onClick={() => onPageChange(page - 1)} size="small" variant="outlined">上一页</Button>
        <Button disabled={loading || !nextEnabled} onClick={() => onPageChange(page + 1)} size="small" variant="outlined">下一页</Button>
        <TextField
          className="jumpPageField"
          label="跳到页"
          onChange={(event) => setJumpPage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") jump();
          }}
          size="small"
          type="number"
          value={jumpPage}
        />
        <Button disabled={loading} onClick={jump} size="small" variant="outlined">跳转</Button>
      </Stack>
    </Box>
  );
}

function AdminQuickCreate({ module, onSubmit }: { module: AdminModule; onSubmit: (body: JsonRecord) => void }): JSX.Element {
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [status, setStatus] = useState("draft");

  useEffect(() => {
    setFirst("");
    setSecond("");
    setStatus("draft");
  }, [module]);

  const config = quickCreateConfig(module);
  if (!config) {
    return (
      <Card className="primaryPanel">
        <CardContent>
          <Typography variant="h6">管理能力</Typography>
          <Typography color="text.secondary">{adminModuleDescription(module)}</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="primaryPanel">
      <CardContent>
        <Typography variant="h6">{config.title}</Typography>
        <Stack direction={{ md: "row", xs: "column" }} spacing={2} sx={{ mt: 2 }}>
          <TextField label={config.firstLabel} onChange={(event) => setFirst(event.target.value)} value={first} />
          <TextField label={config.secondLabel} onChange={(event) => setSecond(event.target.value)} value={second} />
          <TextField label="状态" onChange={(event) => setStatus(event.target.value)} select value={status}>
            <MenuItem value="draft">draft</MenuItem>
            <MenuItem value="active">active</MenuItem>
            <MenuItem value="published">published</MenuItem>
          </TextField>
          <Button onClick={() => onSubmit(config.build(first, second, status))} variant="contained">提交</Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

function AdminList({ items, loading, module, onRefresh }: { items: JsonRecord[]; loading: boolean; module: AdminModule; onRefresh: () => void }): JSX.Element {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const pageItems = items.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [items, module]);

  return (
    <Card className="primaryPanel">
      <CardContent>
        <Stack direction={{ md: "row", xs: "column" }} spacing={1} sx={{ alignItems: { md: "center", xs: "stretch" }, justifyContent: "space-between" }}>
          <Typography variant="h6">数据列表</Typography>
          <Button disabled={loading} onClick={onRefresh} size="small" variant="contained">查询 / 刷新</Button>
        </Stack>
        <List dense>
          {pageItems.map((item, index) => (
            <ListItem key={String(item.id ?? item.wordId ?? item.courseId ?? item.sceneId ?? item.adminUserId ?? index)}>
              <ListItemText primary={adminItemTitle(item, module)} secondary={adminItemSubtitle(item)} />
            </ListItem>
          ))}
          {items.length === 0 ? <ListItem><ListItemText primary="暂无数据或当前接口未返回内容。" /></ListItem> : null}
        </List>
        <PaginationControls
          canGoNext={items.length > page * pageSize}
          itemCount={pageItems.length}
          limit={pageSize}
          loading={loading}
          offset={(page - 1) * pageSize}
          onPageChange={(nextPage) => setPage(Math.max(1, nextPage))}
        />
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <Box className="metricBox">
      <Typography color="text.secondary">{label}</Typography>
      <Typography variant="h4">{value}</Typography>
    </Box>
  );
}

function wordToForm(word: WordEntry): WordFormState {
  return {
    audioStatus: word.audioStatus === "ready" || word.audioStatus === "failed" ? word.audioStatus : "missing",
    audioUrl: word.audioUrl ?? "",
    cdCount: stringValue(word.cdCount),
    cdLow: stringValue(word.cdLow),
    commonCollocations: (word.commonCollocations ?? []).join(", "),
    difficultyDistractors: (word.distractors?.difficulty ?? []).join(", "),
    difficultyLevel: stringValue(word.difficultyLevel),
    exclusionReason: word.exclusionReason ?? "",
    frequencyCount: stringValue(word.frequencyCount),
    frequencyLow: stringValue(word.frequencyLow),
    hearingTrap: word.hearingTrap ?? "",
    isExcluded: word.isExcluded === true,
    lemma: word.lemma ?? "",
    levelTags: (word.levelTags ?? []).join(", "),
    lg10cd: stringValue(word.lg10cd),
    lg10wf: stringValue(word.lg10wf),
    meaningCn: word.meaningCn ?? "",
    meaningDistractors: (word.distractors?.meaning ?? []).join(", "),
    meaningEn: word.meaningEn ?? "",
    partOfSpeech: word.partOfSpeech ?? "",
    phonetic: word.phonetic ?? "",
    pronunciationDistractors: (word.distractors?.pronunciation ?? []).join(", "),
    publishStatus: word.publishStatus ?? "draft",
    reason: "",
    reviewStatus: word.reviewStatus ?? "pending_review",
    sceneTags: (word.sceneTags ?? []).join(", "),
    subtlcd: stringValue(word.subtlcd),
    subtlwf: stringValue(word.subtlwf),
    word: word.word,
  };
}

function wordFormToPayload(form: WordFormState): JsonRecord {
  return {
    audioStatus: form.audioStatus,
    audioUrl: nullableString(form.audioUrl),
    cdCount: nullableNumber(form.cdCount),
    cdLow: nullableNumber(form.cdLow),
    commonCollocations: splitList(form.commonCollocations),
    difficultyLevel: nullableNumber(form.difficultyLevel),
    distractors: {
      difficulty: splitList(form.difficultyDistractors),
      meaning: splitList(form.meaningDistractors),
      pronunciation: splitList(form.pronunciationDistractors),
    },
    exclusionReason: nullableString(form.exclusionReason),
    frequencyCount: nullableNumber(form.frequencyCount),
    frequencyLow: nullableNumber(form.frequencyLow),
    hearingTrap: nullableString(form.hearingTrap),
    isExcluded: form.isExcluded,
    lemma: form.lemma || form.word.toLowerCase(),
    levelTags: splitList(form.levelTags),
    lg10cd: nullableString(form.lg10cd),
    lg10wf: nullableString(form.lg10wf),
    meaningCn: nullableString(form.meaningCn),
    meaningEn: nullableString(form.meaningEn),
    partOfSpeech: nullableString(form.partOfSpeech),
    phonetic: nullableString(form.phonetic),
    reason: nullableString(form.reason) ?? undefined,
    reviewStatus: form.reviewStatus,
    sceneTags: splitList(form.sceneTags),
    subtlcd: nullableString(form.subtlcd),
    subtlwf: nullableString(form.subtlwf),
    word: form.word,
  };
}

function splitList(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function splitLines(value: string): string[] {
  return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

function nullableNumber(value: string): number | null {
  return value.trim() ? Number(value) : null;
}

function nullableString(value: string): string | null {
  return value.trim() ? value.trim() : null;
}

function stringValue(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function shortId(value: string): string {
  return value.length > 12 ? `${value.slice(0, 8)}...` : value;
}

type DictionaryDefinition = {
  antonyms: string[];
  definition: string;
  example: string | null;
  synonyms: string[];
};

type DictionaryMeaning = {
  antonyms: string[];
  definitions: DictionaryDefinition[];
  partOfSpeech: string;
  synonyms: string[];
};

type DictionaryPhonetic = {
  audio: string | null;
  text: string;
};

type DictionaryEntry = {
  licenseName: string | null;
  meanings: DictionaryMeaning[];
  phonetic: string;
  phonetics: DictionaryPhonetic[];
  sourceUrls: string[];
  word: string;
};

function wordMetaDictionaryEntry(meta: WordMeta): DictionaryEntry {
  const rawEntry = firstRawPayloadEntry(meta.rawPayload);
  const meaningsSource = arrayRecordValue(rawEntry, "meanings").length > 0 ? arrayRecordValue(rawEntry, "meanings") : meta.meanings;
  const license = recordValue(rawEntry.license);
  return {
    licenseName: stringRecordValue(license, "name") || meta.licenseName,
    meanings: meaningsSource.map(dictionaryMeaningFromRecord).filter((meaning) => meaning.definitions.length > 0),
    phonetic: stringRecordValue(rawEntry, "phonetic"),
    phonetics: wordMetaPhoneticItems(meta),
    sourceUrls: stringArrayValue(rawEntry.sourceUrls),
    word: stringRecordValue(rawEntry, "word") || meta.word,
  };
}

function firstRawPayloadEntry(payload: WordMeta["rawPayload"]): JsonRecord {
  if (Array.isArray(payload)) return recordValue(payload[0]);
  return recordValue(payload);
}

function dictionaryMeaningFromRecord(record: JsonRecord): DictionaryMeaning {
  return {
    antonyms: stringArrayValue(record.antonyms),
    definitions: arrayRecordValue(record, "definitions").map(dictionaryDefinitionFromRecord).filter((definition) => definition.definition),
    partOfSpeech: stringRecordValue(record, "partOfSpeech"),
    synonyms: stringArrayValue(record.synonyms),
  };
}

function dictionaryDefinitionFromRecord(record: JsonRecord): DictionaryDefinition {
  return {
    antonyms: stringArrayValue(record.antonyms),
    definition: stringRecordValue(record, "definition"),
    example: stringRecordValue(record, "example") || null,
    synonyms: stringArrayValue(record.synonyms),
  };
}

function dictionaryPhoneticFromRecord(record: JsonRecord): DictionaryPhonetic {
  return {
    audio: stringRecordValue(record, "audio") || null,
    text: stringRecordValue(record, "text") || stringRecordValue(record, "phonetic"),
  };
}

function wordMetaPhoneticsText(meta: WordMeta): string {
  const values = wordMetaPhoneticItems(meta)
    .map((item) => item.text)
    .filter(Boolean);
  return values.slice(0, 3).join("  ");
}

function wordMetaPhoneticItems(meta: WordMeta): DictionaryPhonetic[] {
  const entry = firstRawPayloadEntry(meta.rawPayload);
  const rawPhonetics = arrayRecordValue(entry, "phonetics");
  const source = meta.phonetics.length > 0 ? meta.phonetics : rawPhonetics;
  return source.map(dictionaryPhoneticFromRecord);
}

function wordMetaPartsOfSpeechText(meta: WordMeta): string {
  return [...new Set(wordMetaDictionaryEntry(meta).meanings.map((meaning) => meaning.partOfSpeech).filter(Boolean))].join(", ");
}

function stringRecordValue(record: JsonRecord, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function recordValue(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function arrayRecordValue(record: JsonRecord, key: string): JsonRecord[] {
  const value = record[key];
  return Array.isArray(value) ? value.map(recordValue).filter((item) => Object.keys(item).length > 0) : [];
}

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function positiveInt(value: string | number, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function wordPublishBlockReasons(word: WordEntry, bulkStatus: BulkWordStatusState): string[] {
  const reviewStatus = bulkStatus.reviewStatus || word.reviewStatus;
  const audioStatus = bulkStatus.audioStatus || word.audioStatus;
  const reasons = [];
  if (reviewStatus !== "approved") reasons.push("审核未通过");
  if (audioStatus !== "ready") reasons.push("音频未就绪");
  if (word.isExcluded) reasons.push("已排除");
  if (!word.meaningCn) reasons.push("缺中文释义");
  if (!word.meaningEn) reasons.push("缺英文释义");
  if (!word.audioUrl) reasons.push("缺音频 URL");
  if (!word.frequencyCount || !word.cdCount || !word.lg10wf || !word.lg10cd) reasons.push("缺频率或覆盖字段");
  return reasons;
}

function jsonNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createLocalUserSession(): UserSession {
  return { sessionId: `${fallbackUserIdPrefix}-${Date.now()}` };
}

async function loadAdminItems(module: AdminModule): Promise<JsonRecord[]> {
  if (isContentAdminModule(module)) return [];
  if (module === "dashboard") {
    const [accounts, logs] = await Promise.all([adminApi.accounts(), adminApi.auditLogs()]);
    return [...accounts.items, ...logs.items];
  }
  if (module === "admin-foundation") return (await adminApi.accounts()).items;
  if (module === "word-library") return [];
  if (module === "corpus-course") {
    const [scenes, courses, sentences] = await Promise.all([adminApi.scenes(), adminApi.courses(), adminApi.sentences()]);
    return [...scenes.items.map((item) => ({ ...item })), ...courses.items.map((item) => ({ ...item })), ...sentences.items.map((item) => ({ ...item }))];
  }
  if (module === "auto-annotation") return (await adminApi.sentences()).items.map((item) => ({ ...item }));
  if (module === "assessment") return (await adminApi.auditLogs()).items;
  if (module === "user-vocabulary") return (await adminApi.userVocabulary()).items;
  if (module === "activation-practice") return (await adminApi.practiceRules()).items;
  if (module === "daily-task") return (await adminApi.dailyTaskStrategies()).items;
  if (module === "listen-repeat") return (await adminApi.listenRepeatAttempts()).items;
  return (await adminApi.courseReports()).items;
}

async function quickCreate(module: AdminModule, body: JsonRecord): Promise<void> {
  if (module === "admin-foundation") await adminApi.createAccount(body);
  if (module === "word-library") await adminApi.createWord(body);
  if (module === "corpus-course") await adminApi.createScene(body);
  if (module === "auto-annotation") await adminApi.createAnnotationTask(body);
  if (module === "assessment") await adminApi.createAssessmentConfig(body);
  if (module === "activation-practice") await adminApi.createPracticeRule(body);
  if (module === "daily-task") await adminApi.createDailyTaskStrategy(body);
}

function quickCreateConfig(module: AdminModule):
  | { title: string; firstLabel: string; secondLabel: string; build: (first: string, second: string, status: string) => JsonRecord }
  | null {
  if (module === "admin-foundation") {
    return {
      build: (loginName, displayName) => ({ displayName, loginName, reason: "", role: "super_admin" }),
      firstLabel: "登录名",
      secondLabel: "显示名",
      title: "创建管理员",
    };
  }
  if (module === "word-library") {
    return {
      build: (word, meaningCn, publishStatus) => ({ meaningCn, publishStatus, reviewStatus: "pending_review", word }),
      firstLabel: "单词",
      secondLabel: "中文释义",
      title: "创建词条",
    };
  }
  if (module === "corpus-course") {
    return {
      build: (name, description, publishStatus) => ({ description, name, publishStatus }),
      firstLabel: "场景名",
      secondLabel: "说明",
      title: "创建场景",
    };
  }
  if (module === "auto-annotation") {
    return {
      build: (targetId, taskType) => ({ targetId, targetType: "sentence", taskType: taskType || "phrase_chunks" }),
      firstLabel: "目标 ID",
      secondLabel: "任务类型",
      title: "创建标注任务",
    };
  }
  if (module === "assessment") {
    return {
      build: (version, question, status) => ({ selfDescriptionQuestions: [{ key: "q1", text: question }], status, version }),
      firstLabel: "版本",
      secondLabel: "问题",
      title: "创建评估配置",
    };
  }
  if (module === "activation-practice") {
    return {
      build: (version, rule, status) => ({ rules: { note: rule }, status, version }),
      firstLabel: "版本",
      secondLabel: "规则说明",
      title: "创建练习规则",
    };
  }
  if (module === "daily-task") {
    return {
      build: (version, rule, status) => ({ rules: { note: rule }, status, version }),
      firstLabel: "版本",
      secondLabel: "策略说明",
      title: "创建每日任务策略",
    };
  }
  return null;
}

function adminModuleDescription(module: AdminModule): string {
  if (module === "user-vocabulary") return "支持按用户查看待激活、巩固中、已掌握词库，并通过修正接口记录人工调整原因。";
  if (module === "listen-repeat") return "支持查看跟读尝试、ASR 状态、准确率、速度比例和异常记录。";
  if (module === "course-report") return "支持查看用户课程报告、完成率、弱句和激活词统计。";
  return "该模块当前提供列表、审计和接口联调入口。";
}

function adminItemTitle(item: JsonRecord, module: AdminModule): string {
  if (typeof item.word === "string") return item.word;
  if (typeof item.title === "string") return item.title;
  if (typeof item.name === "string") return item.name;
  if (typeof item.loginName === "string") return item.loginName;
  if (typeof item.action === "string") return item.action;
  return module;
}

function adminItemSubtitle(item: JsonRecord): string {
  const parts = [item.publishStatus, item.reviewStatus, item.status, item.createdAt].filter((value) => typeof value === "string");
  return parts.length > 0 ? parts.join(" · ") : JSON.stringify(item).slice(0, 120);
}

function readableError(caught: unknown): string {
  if (caught instanceof ApiError && caught.code === "authRequired") return "需要先登录或创建身份。";
  if (caught instanceof Error) return caught.message;
  return "请求失败";
}

async function loadOptionalLearningList<T>(label: string, loader: () => Promise<ListResponse<T>>, warnings: string[]): Promise<ListResponse<T>> {
  try {
    return await loader();
  } catch (caught) {
    warnings.push(`${label}接口暂不可用：${readableError(caught)}`);
    return { items: [] };
  }
}

function parseRoute(): { view: View; learningTab: LearningTab; adminModule: AdminModule } {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const [area, section] = hash.split("/");
  if (area === "admin") {
    return { adminModule: parseAdminModule(section), learningTab: "today", view: "admin" };
  }
  return { adminModule: "overview", learningTab: parseLearningTab(area), view: "learning" };
}

function parseLearningTab(value: string | undefined): LearningTab {
  return learningTabs.some((tab) => tab.key === value) ? (value as LearningTab) : "today";
}

function parseAdminModule(value: string | undefined): AdminModule {
  if (value === "scenes" || value === "courses") return value;
  return adminModules.some((module) => module.key === value) ? (value as AdminModule) : "overview";
}

function isContentAdminModule(module: AdminModule): module is ContentAdminModule {
  return ["overview", "content", "scenes", "courses", "sentences", "imports", "composition", "publishing"].includes(module);
}
