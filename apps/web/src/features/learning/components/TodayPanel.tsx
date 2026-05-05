import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import HeadphonesIcon from "@mui/icons-material/Headphones";
import LoginIcon from "@mui/icons-material/Login";
import MicIcon from "@mui/icons-material/Mic";
import RepeatIcon from "@mui/icons-material/Repeat";
import SpellcheckIcon from "@mui/icons-material/Spellcheck";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import { useMemo, useState } from "react";
import type { ContinueLearningItem, ContinueLearningResponse, DailyTask, JsonRecord, Sentence, UserSession, VocabularyOverview, WordEntry } from "../../../types";

type DailyTaskItem = JsonRecord & {
  dailyTaskItemId?: string;
  itemType?: string;
  priorityScore?: string;
  sentenceId?: string | null;
  status?: string;
  wordId?: string | null;
};

type TodayPanelProps = {
  continueLearning: ContinueLearningResponse | null;
  dailyTask: DailyTask | null;
  disabled: boolean;
  onContinueLearning: () => Promise<ContinueLearningResponse>;
  onPracticeContinueLearning: (item: ContinueLearningItem, result: PracticeResult) => Promise<void>;
  onPracticeTask: (item: DailyTaskItem, result: PracticeResult) => Promise<void>;
  onResetDailyTask: () => Promise<void>;
  onResetUserSession: () => void;
  onStartPlan: () => Promise<void>;
  overview: VocabularyOverview | null;
  sentences: Sentence[];
  userSession: UserSession | null;
  words: WordEntry[];
};

export type PracticeResult = {
  correctAnswer?: string | null;
  isCorrect: boolean;
  selectedAnswer?: string | null;
};

export function TodayPanel({
  continueLearning,
  dailyTask,
  disabled,
  onContinueLearning,
  onPracticeContinueLearning,
  onPracticeTask,
  onResetDailyTask,
  onResetUserSession,
  onStartPlan,
  overview,
  sentences,
  userSession,
  words,
}: TodayPanelProps): JSX.Element {
  const [feedback, setFeedback] = useState<{ message: string; severity: "success" | "warning"; taskId: string } | null>(null);
  const [planFeedback, setPlanFeedback] = useState<{ message: string; severity: "success" | "warning" } | null>(null);
  const [refreshingDailyTask, setRefreshingDailyTask] = useState(false);
  const [resettingDailyTask, setResettingDailyTask] = useState(false);
  const [submittingTaskId, setSubmittingTaskId] = useState<string | null>(null);
  const [loadingContinueLearning, setLoadingContinueLearning] = useState(false);
  const [continueFeedback, setContinueFeedback] = useState<{ message: string; severity: "success" | "warning"; taskId?: string } | null>(null);
  const [locallyCompletedContinueKeys, setLocallyCompletedContinueKeys] = useState<Set<string>>(() => new Set());
  const [readyForNextCategory, setReadyForNextCategory] = useState(true);
  const [activeTaskType, setActiveTaskType] = useState<string | null>(null);
  const [locallyCompletedTaskKeys, setLocallyCompletedTaskKeys] = useState<Set<string>>(() => new Set());
  const hasVocabulary = (overview?.total ?? 0) > 0;
  const taskItems = (dailyTask?.items ?? []) as DailyTaskItem[];
  const staleEmptyTask = hasVocabulary && Boolean(dailyTask) && taskItems.length === 0;
  const completedCount = taskItems.filter((item) => item.status === "completed" || locallyCompletedTaskKeys.has(taskKey(item))).length;
  const pendingItems = taskItems.filter((item) => item.status !== "completed" && !locallyCompletedTaskKeys.has(taskKey(item)));
  const firstPendingType = pendingItems[0]?.itemType ?? null;
  const activeCategoryType = activeTaskType ?? firstPendingType;
  const currentCategoryType = readyForNextCategory && activeCategoryType && pendingItems.some((item) => item.itemType === activeCategoryType)
    ? activeCategoryType
    : firstPendingType;
  const currentCategoryItems = currentCategoryType ? taskItems.filter((item) => item.itemType === currentCategoryType) : [];
  const currentCategoryCompletedCount = currentCategoryItems.filter((item) => item.status === "completed" || locallyCompletedTaskKeys.has(taskKey(item))).length;
  const currentItem = readyForNextCategory && currentCategoryType
    ? pendingItems.find((item) => item.itemType === currentCategoryType)
    : undefined;
  const nextCategoryItem = activeCategoryType
    ? pendingItems.find((item) => item.itemType !== activeCategoryType)
    : pendingItems[0];
  const currentTaskKey = currentItem ? taskKey(currentItem) : null;
  const currentWord = currentItem?.wordId ? wordMapValue(words, currentItem.wordId) : undefined;
  const currentSentence = currentItem?.sentenceId ? sentenceMapValue(sentences, currentItem.sentenceId) : undefined;
  const progressValue = taskItems.length > 0 ? Math.round((completedCount / taskItems.length) * 100) : 0;
  const wordMap = useMemo(() => new Map(words.map((word) => [word.wordId, word])), [words]);
  const sentenceMap = useMemo(() => new Map(sentences.map((sentence) => [sentence.sentenceId, sentence])), [sentences]);
  const dailyTaskCompleted = taskItems.length > 0 && completedCount >= taskItems.length;
  const showContinueLearning = hasVocabulary && (dailyTaskCompleted || (taskItems.length === 0 && !staleEmptyTask));
  const continueItems = continueLearning?.items ?? [];
  const pendingContinueItems = continueItems.filter((item) => !locallyCompletedContinueKeys.has(continueTaskKey(item)));
  const currentContinueItem = pendingContinueItems[0];
  const currentContinueWord = currentContinueItem ? wordMap.get(currentContinueItem.wordId) : undefined;

  async function submitTask(item: DailyTaskItem, result: PracticeResult): Promise<void> {
    const key = taskKey(item);
    setSubmittingTaskId(key);
    setFeedback({ message: "正在提交并更新任务状态。", severity: "success", taskId: key });
    try {
      setActiveTaskType(item.itemType ?? null);
      await onPracticeTask(item, result);
      setLocallyCompletedTaskKeys((current) => new Set(current).add(key));
      const hasMoreInCurrentCategory = taskItems.some(
        (candidate) =>
          taskKey(candidate) !== key &&
          candidate.status !== "completed" &&
          !locallyCompletedTaskKeys.has(taskKey(candidate)) &&
          candidate.itemType === item.itemType,
      );
      setReadyForNextCategory(hasMoreInCurrentCategory);
      setFeedback({
        message: result.isCorrect ? "回答正确，任务已完成。" : "已提交，本次尝试已记录。",
        severity: result.isCorrect ? "success" : "warning",
        taskId: key,
      });
    } catch {
      setFeedback({ message: "提交失败，请重试。", severity: "warning", taskId: key });
    } finally {
      setSubmittingTaskId(null);
    }
  }

  async function resetDailyTask(): Promise<void> {
    setResettingDailyTask(true);
    setPlanFeedback({ message: "正在重置今日计划。", severity: "success" });
    try {
      await onResetDailyTask();
      setReadyForNextCategory(true);
      setActiveTaskType(null);
      setLocallyCompletedTaskKeys(new Set());
      setFeedback(null);
      setPlanFeedback({ message: "今日计划已重置，任务已重新加载。", severity: "success" });
    } catch {
      setPlanFeedback({ message: "重置失败，请确认后端服务可用后重试。", severity: "warning" });
    } finally {
      setResettingDailyTask(false);
    }
  }

  async function refreshDailyTask(): Promise<void> {
    setRefreshingDailyTask(true);
    setPlanFeedback({ message: "正在刷新今日计划。", severity: "success" });
    try {
      await onStartPlan();
      setReadyForNextCategory(true);
      setActiveTaskType(null);
      setLocallyCompletedTaskKeys(new Set());
      setPlanFeedback({ message: hasVocabulary ? "今日计划已刷新。" : "请先完成水平评估生成激活词库。", severity: "success" });
    } catch {
      setPlanFeedback({ message: "刷新失败，请确认后端服务可用后重试。", severity: "warning" });
    } finally {
      setRefreshingDailyTask(false);
    }
  }

  async function startContinueLearning(): Promise<void> {
    setLoadingContinueLearning(true);
    setContinueFeedback({ message: "正在获取下一组可练内容。", severity: "success" });
    try {
      const response = await onContinueLearning();
      setLocallyCompletedContinueKeys(new Set());
      setContinueFeedback({
        message: response.items.length > 0 ? `已生成 ${response.items.length} 个继续学习任务。` : "暂时没有可练内容，请查看下方原因。",
        severity: response.items.length > 0 ? "success" : "warning",
      });
    } catch {
      setContinueFeedback({ message: "继续学习加载失败，请确认后端服务可用后重试。", severity: "warning" });
    } finally {
      setLoadingContinueLearning(false);
    }
  }

  async function submitContinueTask(item: ContinueLearningItem, result: PracticeResult): Promise<void> {
    const key = continueTaskKey(item);
    setSubmittingTaskId(key);
    setContinueFeedback({ message: "正在提交继续学习结果。", severity: "success", taskId: key });
    try {
      await onPracticeContinueLearning(item, result);
      setLocallyCompletedContinueKeys((current) => new Set(current).add(key));
      setContinueFeedback({
        message: result.isCorrect ? "回答正确，本题已完成。" : "已提交，本次尝试已记录。",
        severity: result.isCorrect ? "success" : "warning",
        taskId: key,
      });
    } catch {
      setContinueFeedback({ message: "提交失败，请重试。", severity: "warning", taskId: key });
    } finally {
      setSubmittingTaskId(null);
    }
  }

  return (
    <Stack className="contentGrid" spacing={2}>
      <Card className="primaryPanel">
        <CardContent>
          <Stack direction={{ md: "row", xs: "column" }} spacing={2} sx={{ justifyContent: "space-between" }}>
            <Box>
              <Typography variant="h5">今日激活计划</Typography>
              <Typography color="text.secondary">基于激活词状态生成听辨、复习和跟读任务。</Typography>
            </Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
              <Typography color="text.secondary" variant="body2">激活词状态</Typography>
              <Chip color="error" label={`待激活 ${overview?.red ?? 0}`} size="small" />
              <Chip color="warning" label={`巩固中 ${overview?.yellow ?? 0}`} size="small" />
              <Chip color="success" label={`已掌握 ${overview?.green ?? 0}`} size="small" />
            </Stack>
          </Stack>

          <Stack direction={{ md: "row", xs: "column" }} spacing={2} sx={{ mt: 2 }}>
            <PlanMetric label="任务数" value={String(taskItems.length)} />
            <PlanMetric label="预计分钟" value={String(dailyTask?.summary?.estimatedMinutes ?? "-")} />
            <PlanMetric label="完成进度" value={`${completedCount}/${taskItems.length}`} />
            <PlanMetric label="策略" value={dailyTask?.strategyVersion ?? "-"} />
          </Stack>

          {taskItems.length > 0 ? <LinearProgress sx={{ mt: 2 }} value={progressValue} variant="determinate" /> : null}

          <Stack direction={{ md: "row", xs: "column" }} spacing={1} sx={{ alignItems: { md: "center", xs: "flex-start" }, mt: 2 }}>
            {userSession ? <Typography color="text.secondary">当前身份：{userSession.sessionId}</Typography> : null}
            <Button disabled={disabled || refreshingDailyTask} onClick={refreshDailyTask} size="small" startIcon={<TaskAltIcon />} variant="contained">
              {refreshingDailyTask ? "刷新中" : hasVocabulary ? "刷新今日计划" : "先做水平评估"}
            </Button>
            {userSession ? (
              <Button disabled={disabled || refreshingDailyTask || resettingDailyTask} onClick={resetDailyTask} size="small" variant="outlined">
                {resettingDailyTask ? "重置中" : "重置今日计划"}
              </Button>
            ) : null}
            {staleEmptyTask ? (
              <Button disabled={disabled} onClick={onResetUserSession} size="small" variant="outlined">
                重新创建身份
              </Button>
            ) : null}
            {!userSession ? (
              <Button disabled={disabled || refreshingDailyTask} onClick={refreshDailyTask} size="small" startIcon={<LoginIcon />} variant="contained">
                开始激活
              </Button>
            ) : null}
          </Stack>
          {planFeedback ? (
            <Alert severity={planFeedback.severity} sx={{ mt: 2 }}>
              {planFeedback.message}
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {staleEmptyTask ? (
        <Alert severity="warning">
          当前身份已有 {overview?.total ?? 0} 个激活词，但今天的任务是在词库为空时生成的空计划。请点击“重置今日计划”重新生成当天任务。
        </Alert>
      ) : null}

      {taskItems.length > 0 ? (
        readyForNextCategory ? (
          <CurrentTaskPanel
            categoryCompletedCount={currentCategoryCompletedCount}
            categoryTotalCount={currentCategoryItems.length}
            completedCount={completedCount}
            currentItem={currentItem}
            disabled={disabled}
            feedback={currentTaskKey && feedback?.taskId === currentTaskKey ? feedback : null}
            onPracticeTask={submitTask}
            sentence={currentSentence}
            submitting={Boolean(currentTaskKey && submittingTaskId === currentTaskKey)}
            totalCount={taskItems.length}
            word={currentWord}
            words={words}
          />
        ) : (
          <NextTaskGate
            completedCount={completedCount}
            completedTaskType={activeCategoryType}
            nextItem={nextCategoryItem}
            onStartNext={() => {
              setActiveTaskType(nextCategoryItem?.itemType ?? null);
              setFeedback(null);
              setReadyForNextCategory(true);
            }}
            sentenceMap={sentenceMap}
            totalCount={taskItems.length}
            wordMap={wordMap}
          />
        )
      ) : null}

      {showContinueLearning ? (
        <ContinueLearningPanel
          disabled={disabled || loadingContinueLearning}
          feedback={continueFeedback}
          hasMore={continueLearning?.hasMore ?? false}
          items={continueItems}
          loading={loadingContinueLearning}
          onLoad={startContinueLearning}
          onPracticeTask={submitContinueTask}
          pendingCount={pendingContinueItems.length}
          submittingTaskId={submittingTaskId}
          currentItem={currentContinueItem}
          word={currentContinueWord}
          words={words}
          emptyReasons={continueLearning?.emptyReasons ?? []}
        />
      ) : null}

      {taskItems.length > 0 ? (
        <TaskQueueOverview
          items={taskItems}
          wordMap={wordMap}
          sentenceMap={sentenceMap}
        />
      ) : null}

      {taskItems.length === 0 ? (
        <Card className="primaryPanel">
          <CardContent>
            <Typography color="text.secondary">{hasVocabulary ? "今日任务为空，请刷新今日计划。" : "暂无任务，先完成水平评估生成激活词库。"}</Typography>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  );
}

function PlanMetric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <Box className="metricBox" sx={{ py: 1.25 }}>
      <Typography color="text.secondary" variant="body2">{label}</Typography>
      <Typography sx={{ overflowWrap: "anywhere" }} variant="h6">{value}</Typography>
    </Box>
  );
}

function CurrentTaskPanel({
  categoryCompletedCount,
  categoryTotalCount,
  completedCount,
  currentItem,
  disabled,
  feedback,
  onPracticeTask,
  sentence,
  submitting,
  totalCount,
  word,
  words,
}: {
  categoryCompletedCount: number;
  categoryTotalCount: number;
  completedCount: number;
  currentItem?: DailyTaskItem | undefined;
  disabled: boolean;
  feedback: { message: string; severity: "success" | "warning"; taskId: string } | null;
  onPracticeTask: (item: DailyTaskItem, result: PracticeResult) => Promise<void>;
  sentence?: Sentence | undefined;
  submitting: boolean;
  totalCount: number;
  word?: WordEntry | undefined;
  words: WordEntry[];
}): JSX.Element {
  if (!currentItem) {
    return (
      <Card className="primaryPanel">
        <CardContent>
          <Stack spacing={1.5} sx={{ alignItems: "center", py: { md: 4, xs: 2 }, textAlign: "center" }}>
            <Chip color="success" label="今日已完成" size="small" />
            <Typography variant="h5">今天的激活任务已全部完成</Typography>
            <Typography color="text.secondary">可以到“我的词库”查看掌握状态，或明天继续新的计划。</Typography>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  const meta = taskTypeMeta(currentItem.itemType);
  return (
    <Card className="primaryPanel">
      <CardContent>
        <Stack direction={{ md: "row", xs: "column" }} spacing={1.5} sx={{ justifyContent: "space-between" }}>
          <Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
              {meta.icon}
              <Typography variant="h6">{meta.label}</Typography>
            </Stack>
            <Typography color="text.secondary" variant="body2">
              本类第 {Math.min(categoryCompletedCount + 1, categoryTotalCount)} / {categoryTotalCount} 个，总进度 {Math.min(completedCount + 1, totalCount)} / {totalCount}。同类任务完成后再询问是否进入下一类。
            </Typography>
          </Box>
          <Chip color="primary" label={currentItem.status ?? "pending"} size="small" sx={{ alignSelf: { md: "flex-start", xs: "flex-start" } }} />
        </Stack>
        <PracticeCard disabled={disabled || submitting} item={currentItem} onPracticeTask={onPracticeTask} sentence={sentence} word={word} words={words} />
        {feedback ? <Alert severity={feedback.severity} sx={{ mt: 1.5 }}>{feedback.message}</Alert> : null}
      </CardContent>
    </Card>
  );
}

function NextTaskGate({
  completedCount,
  completedTaskType,
  nextItem,
  onStartNext,
  sentenceMap,
  totalCount,
  wordMap,
}: {
  completedCount: number;
  completedTaskType?: null | string;
  nextItem?: DailyTaskItem | undefined;
  onStartNext: () => void;
  sentenceMap: Map<string, Sentence>;
  totalCount: number;
  wordMap: Map<string, WordEntry>;
}): JSX.Element {
  if (!nextItem) {
    return (
      <Card className="primaryPanel taskTransitionPanel">
        <CardContent>
          <Stack spacing={1.5} sx={{ alignItems: "center", py: { md: 5, xs: 3 }, textAlign: "center" }}>
            <Chip color="success" label="今日已完成" size="small" />
            <Typography variant="h5">今天的激活任务已全部完成</Typography>
            <Typography color="text.secondary">你可以休息，也可以去“我的词库”查看掌握状态。</Typography>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="primaryPanel taskTransitionPanel">
      <CardContent>
        <Stack spacing={2} sx={{ alignItems: "center", py: { md: 5, xs: 3 }, textAlign: "center" }}>
          <Chip color="success" label={`已完成 ${completedCount}/${totalCount}`} size="small" />
          <Typography variant="h5">{taskTypeMeta(completedTaskType ?? undefined).label}已完成</Typography>
          <Typography color="text.secondary">是否进入下一类任务：{taskTypeMeta(nextItem.itemType).label}？</Typography>
          <Typography color="text.secondary">下一项预览：{taskPreview(nextItem, wordMap, sentenceMap)}</Typography>
          <Button onClick={onStartNext} size="large" startIcon={<TaskAltIcon />} variant="contained">开始下一类任务</Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

function ContinueLearningPanel({
  currentItem,
  disabled,
  emptyReasons,
  feedback,
  hasMore,
  items,
  loading,
  onLoad,
  onPracticeTask,
  pendingCount,
  submittingTaskId,
  word,
  words,
}: {
  currentItem?: ContinueLearningItem | undefined;
  disabled: boolean;
  emptyReasons: string[];
  feedback: { message: string; severity: "success" | "warning"; taskId?: string } | null;
  hasMore: boolean;
  items: ContinueLearningItem[];
  loading: boolean;
  onLoad: () => Promise<void>;
  onPracticeTask: (item: ContinueLearningItem, result: PracticeResult) => Promise<void>;
  pendingCount: number;
  submittingTaskId: string | null;
  word?: WordEntry | undefined;
  words: WordEntry[];
}): JSX.Element {
  const taskItem = currentItem ? continueItemToDailyTaskItem(currentItem) : undefined;
  const currentKey = currentItem ? continueTaskKey(currentItem) : null;

  return (
    <Card className="primaryPanel">
      <CardContent>
        <Stack direction={{ md: "row", xs: "column" }} spacing={1.5} sx={{ justifyContent: "space-between" }}>
          <Box>
            <Typography variant="h6">继续学习</Typography>
            <Typography color="text.secondary" variant="body2">今日推荐完成后，可以主动获取下一组可练词；每组完成后再决定是否继续。</Typography>
          </Box>
          <Button disabled={disabled || loading} onClick={onLoad} startIcon={<TaskAltIcon />} variant={items.length > 0 ? "outlined" : "contained"}>
            {loading ? "加载中" : items.length > 0 ? "再取一组" : "继续学习"}
          </Button>
        </Stack>

        {feedback ? <Alert severity={feedback.severity} sx={{ mt: 1.5 }}>{feedback.message}</Alert> : null}

        {items.length === 0 && emptyReasons.length > 0 ? (
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", mt: 1.5 }}>
            {emptyReasons.map((reason) => <Chip key={reason} label={continueEmptyReasonLabel(reason)} size="small" variant="outlined" />)}
          </Stack>
        ) : null}

        {taskItem && currentItem ? (
          <Box sx={{ mt: 1.5 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", mb: 1 }}>
              <Chip color="primary" label={`剩余 ${pendingCount}/${items.length}`} size="small" />
              <Chip label={prioritySourceLabel(currentItem.prioritySource)} size="small" variant="outlined" />
              {hasMore ? <Chip color="warning" label="后面还有可练内容" size="small" variant="outlined" /> : null}
            </Stack>
            <PracticeCard
              disabled={disabled || Boolean(currentKey && submittingTaskId === currentKey)}
              item={taskItem}
              onPracticeTask={(_, result) => onPracticeTask(currentItem, result)}
              word={word}
              words={words}
            />
          </Box>
        ) : items.length > 0 ? (
          <Stack spacing={1.5} sx={{ alignItems: "center", py: 2, textAlign: "center" }}>
            <Chip color="success" label="本组已完成" size="small" />
            <Typography color="text.secondary">是否再练一组？点击“再取一组”后才会生成下一批。</Typography>
          </Stack>
        ) : null}
      </CardContent>
    </Card>
  );
}

function TaskQueueOverview({
  items,
  sentenceMap,
  wordMap,
}: {
  items: DailyTaskItem[];
  sentenceMap: Map<string, Sentence>;
  wordMap: Map<string, WordEntry>;
}): JSX.Element {
  const groups = [
    { count: items.filter((item) => item.itemType === "audio_meaning").length, icon: <HeadphonesIcon fontSize="small" />, label: "听音辨义" },
    { count: items.filter((item) => item.itemType === "review_word").length, icon: <SpellcheckIcon fontSize="small" />, label: "词汇复习" },
    { count: items.filter((item) => item.itemType === "repeat_sentence").length, icon: <RepeatIcon fontSize="small" />, label: "句子跟读" },
  ];
  const nextItems = items.filter((item) => item.status !== "completed").slice(0, 3);

  return (
    <Card className="primaryPanel">
      <CardContent>
        <Stack direction={{ md: "row", xs: "column" }} spacing={1.5} sx={{ justifyContent: "space-between" }}>
          <Box>
            <Typography variant="h6">任务队列</Typography>
            <Typography color="text.secondary" variant="body2">只展示当前任务，下面是类型统计和后续预览。</Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            {groups.map((group) => (
              <Chip icon={group.icon} key={group.label} label={`${group.label} ${group.count}`} size="small" variant="outlined" />
            ))}
          </Stack>
        </Stack>
        {nextItems.length > 1 ? (
          <Stack direction="row" spacing={1} sx={{ mt: 1.5, overflowX: "auto", pb: 0.5 }}>
            {nextItems.slice(1).map((item) => (
              <Chip
                key={taskKey(item)}
                label={taskPreview(item, wordMap, sentenceMap)}
                size="small"
                sx={{ maxWidth: 220 }}
                variant="outlined"
              />
            ))}
          </Stack>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PracticeCard({
  disabled,
  item,
  onPracticeTask,
  sentence,
  word,
  words,
}: {
  disabled: boolean;
  item: DailyTaskItem;
  onPracticeTask: (item: DailyTaskItem, result: PracticeResult) => Promise<void>;
  sentence?: Sentence | undefined;
  word?: WordEntry | undefined;
  words: WordEntry[];
}): JSX.Element {
  const [repeatText, setRepeatText] = useState("");

  if (item.itemType === "repeat_sentence") {
    const targetWords = sentence?.targetWords ?? [];
    const phraseChunks = sentence?.phraseChunks ?? [];
    const submitText = repeatText.trim() || sentence?.sentenceText || null;
    return (
      <Box sx={{ bgcolor: "action.hover", borderRadius: 1, mt: 2, p: { md: 2, xs: 1.25 } }}>
        {sentence ? (
          <Stack spacing={1.5}>
            <Box>
              <Typography color="text.secondary" variant="body2">先听，再跟读这一句</Typography>
              <Typography sx={{ mt: 0.5, overflowWrap: "anywhere" }} variant="h5">{sentence.sentenceText}</Typography>
              {sentence.translationCn ? <Typography color="text.secondary" sx={{ mt: 0.5 }}>{sentence.translationCn}</Typography> : null}
            </Box>
            <Stack direction={{ md: "row", xs: "column" }} spacing={1}>
              <AudioBlock label="慢速" src={sentence.slowAudioUrl} />
              <AudioBlock label="原速" src={sentence.normalAudioUrl} />
            </Stack>
            {targetWords.length > 0 || phraseChunks.length > 0 ? (
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                {targetWords.map((targetWord) => <Chip color="primary" key={`word-${targetWord}`} label={targetWord} size="small" variant="outlined" />)}
                {phraseChunks.map((chunk) => <Chip key={`chunk-${chunk}`} label={chunk} size="small" />)}
              </Stack>
            ) : null}
            <TextField
              fullWidth
              label="跟读后可填入听到的内容"
              maxRows={3}
              minRows={2}
              onChange={(event) => setRepeatText(event.target.value)}
              size="small"
              value={repeatText}
              multiline
            />
            <Stack direction={{ md: "row", xs: "column" }} spacing={1}>
              <Button
                disabled={disabled || !item.sentenceId}
                onClick={() => onPracticeTask(item, { isCorrect: true, selectedAnswer: submitText })}
                size="large"
                startIcon={<MicIcon />}
                variant="contained"
              >
                提交跟读
              </Button>
              <Button
                disabled={disabled || !item.sentenceId}
                onClick={() => onPracticeTask(item, { isCorrect: true, selectedAnswer: sentence.sentenceText })}
                size="large"
                variant="outlined"
              >
                我已跟读
              </Button>
            </Stack>
          </Stack>
        ) : (
          <Alert severity="warning">当前任务只有句子 ID，缺少句子详情，暂不能开始跟读。</Alert>
        )}
      </Box>
    );
  }

  const correctAnswer = wordMeaningText(word) || null;
  const options = meaningOptions(word, words);
  const canAnswerMeaning = Boolean(correctAnswer);
  return (
    <Box sx={{ bgcolor: "action.hover", borderRadius: 1, mt: 2, p: { md: 2, xs: 1.25 } }}>
      <Typography color="text.secondary" variant="body2">{item.itemType === "review_word" ? "看单词，选择正确释义" : "先听音频，选择对应释义"}</Typography>
      {word ? (
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <Box>
            <Typography sx={{ overflowWrap: "anywhere" }} variant="h4">{word.word}</Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", mt: 0.75 }}>
              {word.phonetic ? <Chip label={word.phonetic} size="small" variant="outlined" /> : null}
              {wordPartOfSpeechText(word) ? <Chip label={wordPartOfSpeechText(word)} size="small" /> : null}
              {word.difficultyLevel ? <Chip label={`难度 ${word.difficultyLevel}`} size="small" /> : null}
            </Stack>
          </Box>
          {word.audioUrl ? <AudioBlock label="单词音频" src={word.audioUrl} /> : <Alert severity="warning">该词没有可播放音频，只能先按释义练习。</Alert>}
          {word.senses?.[0]?.definition ? <Typography color="text.secondary" variant="body2">{word.senses[0].definition}</Typography> : null}
          {canAnswerMeaning ? (
            <Stack spacing={1}>
              {options.map((option) => (
                <Button
                  disabled={disabled}
                  key={option}
                  onClick={() => onPracticeTask(item, { correctAnswer, isCorrect: option === correctAnswer, selectedAnswer: option })}
                  size="large"
                  sx={{ justifyContent: "flex-start", textAlign: "left", whiteSpace: "normal" }}
                  variant="outlined"
                >
                  {option}
                </Button>
              ))}
            </Stack>
          ) : (
            <Stack spacing={1}>
              <Alert severity="warning">该词缺少释义，暂不能完成选择题。请跳过该任务，后台补全词条后再练。</Alert>
              <Button
                disabled={disabled}
                onClick={() => onPracticeTask(item, { correctAnswer: null, isCorrect: false, selectedAnswer: null })}
                variant="outlined"
              >
                跳过该任务
              </Button>
            </Stack>
          )}
        </Stack>
      ) : (
        <Alert severity="warning" sx={{ mt: 1 }}>当前任务只有词 ID，缺少词条详情，暂不能开始听音辨义。</Alert>
      )}
    </Box>
  );
}

function AudioBlock({ label, src }: { label: string; src?: null | string | undefined }): JSX.Element {
  return (
    <Box sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 1, flex: 1, minWidth: 0, p: 1 }}>
      <Typography color="text.secondary" variant="caption">{label}</Typography>
      {src ? <audio controls src={src} /> : <Typography color="text.secondary" variant="body2">暂无音频</Typography>}
    </Box>
  );
}

function continueItemToDailyTaskItem(item: ContinueLearningItem): DailyTaskItem {
  return {
    ...item,
    itemType: item.practiceType === "review" ? "review_word" : "audio_meaning",
    status: "pending",
  };
}

function continueTaskKey(item: ContinueLearningItem): string {
  return `continue-${item.practiceType}-${item.prioritySource}-${item.wordId}`;
}

function prioritySourceLabel(source: string): string {
  if (source === "due_review") return "到期复习";
  if (source === "yellow_consolidation") return "巩固听觉词";
  if (source === "red_activation") return "待激活词";
  if (source === "next_unlocked_batch") return "下一批已解锁词";
  return source;
}

function continueEmptyReasonLabel(reason: string): string {
  if (reason === "no_user_vocabulary") return "还没有激活词库";
  if (reason === "no_available_content") return "没有可练内容";
  if (reason === "no_due_review_words") return "没有到期复习词";
  if (reason === "no_yellow_words") return "没有巩固中听觉词";
  if (reason === "no_unlocked_red_words") return "没有已解锁待激活词";
  if (reason === "no_next_unlocked_batch") return "没有下一批已解锁词";
  if (reason === "content_not_published") return "内容未发布或未审核";
  if (reason === "no_audio") return "缺少可播放音频";
  return reason;
}

function taskTypeMeta(itemType?: string): { icon: JSX.Element; label: string } {
  if (itemType === "audio_meaning") return { icon: <HeadphonesIcon fontSize="small" />, label: "听音辨义" };
  if (itemType === "review_word") return { icon: <SpellcheckIcon fontSize="small" />, label: "词汇复习" };
  if (itemType === "repeat_sentence") return { icon: <RepeatIcon fontSize="small" />, label: "句子跟读" };
  return { icon: <TaskAltIcon fontSize="small" />, label: itemType ?? "任务" };
}

function meaningOptions(target: WordEntry | undefined, words: WordEntry[]): string[] {
  const correct = wordMeaningText(target);
  if (!correct) return [];
  const distractors = words
    .filter((word) => word.wordId !== target?.wordId)
    .map(wordMeaningText)
    .filter((value): value is string => Boolean(value && value !== correct))
    .slice(0, 3);
  return [correct, ...distractors];
}

function wordMeaningText(word: WordEntry | undefined): string {
  return word?.meaningCn ?? word?.senses?.[0]?.definition ?? "";
}

function wordPartOfSpeechText(word: WordEntry): string {
  return [...new Set((word.senses ?? []).map((sense) => sense.partOfSpeech).filter(Boolean))].join(", ");
}

function taskPreview(item: DailyTaskItem, wordMap: Map<string, WordEntry>, sentenceMap: Map<string, Sentence>): string {
  const meta = taskTypeMeta(item.itemType);
  if (item.wordId) {
    const word = wordMap.get(item.wordId);
    return `${meta.label}: ${word?.word ?? item.wordId}`;
  }
  if (item.sentenceId) {
    const sentence = sentenceMap.get(item.sentenceId);
    return `${meta.label}: ${sentence?.sentenceText ?? item.sentenceId}`;
  }
  return meta.label;
}

function wordMapValue(words: WordEntry[], wordId: string): WordEntry | undefined {
  return words.find((word) => word.wordId === wordId);
}

function sentenceMapValue(sentences: Sentence[], sentenceId: string): Sentence | undefined {
  return sentences.find((sentence) => sentence.sentenceId === sentenceId);
}

function taskKey(item: DailyTaskItem): string {
  return item.dailyTaskItemId ?? `${item.itemType}-${item.wordId ?? item.sentenceId ?? "unknown"}`;
}
