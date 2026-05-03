import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import HeadphonesIcon from "@mui/icons-material/Headphones";
import LoginIcon from "@mui/icons-material/Login";
import MicIcon from "@mui/icons-material/Mic";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RepeatIcon from "@mui/icons-material/Repeat";
import SpellcheckIcon from "@mui/icons-material/Spellcheck";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import { useMemo, useState } from "react";
import type { DailyTask, JsonRecord, Sentence, UserSession, VocabularyOverview, WordEntry } from "../../../types";

type DailyTaskItem = JsonRecord & {
  dailyTaskItemId?: string;
  itemType?: string;
  priorityScore?: string;
  sentenceId?: string | null;
  status?: string;
  wordId?: string | null;
};

type TodayPanelProps = {
  dailyTask: DailyTask | null;
  disabled: boolean;
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
  dailyTask,
  disabled,
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
  const hasVocabulary = (overview?.total ?? 0) > 0;
  const taskItems = (dailyTask?.items ?? []) as DailyTaskItem[];
  const staleEmptyTask = hasVocabulary && Boolean(dailyTask) && taskItems.length === 0;
  const completedCount = taskItems.filter((item) => item.status === "completed").length;
  const pendingItems = taskItems.filter((item) => item.status !== "completed");
  const currentItem = pendingItems[0];
  const currentTaskKey = currentItem ? taskKey(currentItem) : null;
  const currentWord = currentItem?.wordId ? wordMapValue(words, currentItem.wordId) : undefined;
  const currentSentence = currentItem?.sentenceId ? sentenceMapValue(sentences, currentItem.sentenceId) : undefined;
  const progressValue = taskItems.length > 0 ? Math.round((completedCount / taskItems.length) * 100) : 0;
  const wordMap = useMemo(() => new Map(words.map((word) => [word.wordId, word])), [words]);
  const sentenceMap = useMemo(() => new Map(sentences.map((sentence) => [sentence.sentenceId, sentence])), [sentences]);

  async function submitTask(item: DailyTaskItem, result: PracticeResult): Promise<void> {
    const key = taskKey(item);
    setSubmittingTaskId(key);
    setFeedback({ message: "正在提交并更新任务状态。", severity: "success", taskId: key });
    try {
      await onPracticeTask(item, result);
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
      setPlanFeedback({ message: hasVocabulary ? "今日计划已刷新。" : "请先完成水平评估生成激活词库。", severity: "success" });
    } catch {
      setPlanFeedback({ message: "刷新失败，请确认后端服务可用后重试。", severity: "warning" });
    } finally {
      setRefreshingDailyTask(false);
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
        <CurrentTaskPanel
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
            <Typography color="text.secondary" variant="body2">第 {Math.min(completedCount + 1, totalCount)} / {totalCount} 个任务，完成后自动进入下一个。</Typography>
          </Box>
          <Chip color="primary" label={currentItem.status ?? "pending"} size="small" sx={{ alignSelf: { md: "flex-start", xs: "flex-start" } }} />
        </Stack>
        <PracticeCard disabled={disabled || submitting} item={currentItem} onPracticeTask={onPracticeTask} sentence={sentence} word={word} words={words} />
        {feedback ? <Alert severity={feedback.severity} sx={{ mt: 1.5 }}>{feedback.message}</Alert> : null}
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
          disabled={disabled}
  item: DailyTaskItem;
  onPracticeTask: (item: DailyTaskItem, result: PracticeResult) => Promise<void>;
  sentence?: Sentence | undefined;
  word?: WordEntry | undefined;
  words: WordEntry[];
}): JSX.Element {
  if (item.itemType === "repeat_sentence") {
    return (
      <Box sx={{ bgcolor: "action.hover", borderRadius: 1, mt: 1, p: 1 }}>
        <Typography variant="subtitle2">跟读句子</Typography>
        <Typography sx={{ my: 1 }}>{sentence?.sentenceText ?? "当前任务缺少句子详情。"}</Typography>
        {sentence?.normalAudioUrl ? <audio controls src={sentence.normalAudioUrl} /> : null}
        <Button disabled={disabled || !item.sentenceId} onClick={() => onPracticeTask(item, { isCorrect: true, selectedAnswer: sentence?.sentenceText ?? null })} size="small" variant="contained">
          完成跟读
        </Button>
      </Box>
    );
  }

  const correctAnswer = word?.meaningCn ?? word?.meaningEn ?? null;
  const options = meaningOptions(word, words);
  return (
    <Box sx={{ bgcolor: "action.hover", borderRadius: 1, mt: 1, p: 1 }}>
      <Typography variant="subtitle2">{item.itemType === "review_word" ? "选择正确释义" : "听音频，选择对应释义"}</Typography>
      {word ? (
        <Stack spacing={1} sx={{ mt: 1 }}>
          {item.itemType === "review_word" ? <Typography variant="h6">{word.word}</Typography> : null}
          {word.audioUrl ? <audio controls src={word.audioUrl} /> : <Alert severity="warning">该词没有可播放音频，只能先按释义练习。</Alert>}
          <Stack spacing={1}>
            {options.map((option) => (
              <Button
                disabled={disabled}
                key={option}
                onClick={() => onPracticeTask(item, { correctAnswer, isCorrect: option === correctAnswer, selectedAnswer: option })}
                size="small"
                variant="outlined"
              >
                {option}
              </Button>
            ))}
          </Stack>
        </Stack>
      ) : (
        <Alert severity="warning" sx={{ mt: 1 }}>当前任务只有词 ID，缺少词条详情，暂不能开始听音辨义。</Alert>
      )}
    </Box>
  );
}

function taskTypeMeta(itemType?: string): { icon: JSX.Element; label: string } {
  if (itemType === "audio_meaning") return { icon: <HeadphonesIcon fontSize="small" />, label: "听音辨义" };
  if (itemType === "review_word") return { icon: <SpellcheckIcon fontSize="small" />, label: "词汇复习" };
  if (itemType === "repeat_sentence") return { icon: <RepeatIcon fontSize="small" />, label: "句子跟读" };
  return { icon: <TaskAltIcon fontSize="small" />, label: itemType ?? "任务" };
}

function meaningOptions(target: WordEntry | undefined, words: WordEntry[]): string[] {
  const correct = target?.meaningCn ?? target?.meaningEn;
  if (!correct) return [];
  const distractors = words
    .filter((word) => word.wordId !== target?.wordId)
    .map((word) => word.meaningCn ?? word.meaningEn)
    .filter((value): value is string => Boolean(value && value !== correct))
    .slice(0, 3);
  return [correct, ...distractors];
}

function taskKey(item: DailyTaskItem): string {
  return item.dailyTaskItemId ?? `${item.itemType}-${item.wordId ?? item.sentenceId ?? "unknown"}`;
}
