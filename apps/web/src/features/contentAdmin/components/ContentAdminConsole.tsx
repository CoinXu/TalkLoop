/* eslint-disable react/destructuring-assignment */
import {
  Alert,
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
  MenuItem,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import ArchiveIcon from "@mui/icons-material/Archive";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DownloadIcon from "@mui/icons-material/Download";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import LibraryAddIcon from "@mui/icons-material/LibraryAdd";
import PublishIcon from "@mui/icons-material/Publish";
import RestoreIcon from "@mui/icons-material/Restore";
import SaveIcon from "@mui/icons-material/Save";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { useCallback, useEffect, useState } from "react";
import { adminApi } from "../../../api/learningActivationApi";
import type { JsonRecord } from "../../../types";
import type {
  AudioStatus,
  AuditEntry,
  BulkResult,
  ContentAdminState,
  ContentCourse,
  ContentScene,
  ContentSentence,
  ContentStatus,
  ImportPreviewRow,
  ValidationIssue,
} from "../types";

export type ContentAdminModule = "overview" | "content" | "scenes" | "courses" | "sentences" | "imports" | "composition" | "publishing";

interface ContentAdminConsoleProps {
  module: ContentAdminModule;
  operatorName: string;
}

const statusOptions: ContentStatus[] = ["draft", "published", "unpublished", "archived"];
const audioOptions: Array<AudioStatus | ""> = ["", "real", "default", "missing", "unreachable"];
const importSteps = ["上传", "字段映射", "预校验", "导入", "结果"];
const listPageSize = 10;
const levelDescriptions: Record<string, string> = {
  A2: "基础沟通：能理解日常短句，适合入门巩固",
  B1: "独立表达：能处理工作和生活常见场景",
  B2: "进阶表达：能理解较复杂表达和抽象话题",
};
const levelOptions = [
  { code: "A2", description: levelDescriptions.A2, value: 2 },
  { code: "B1", description: levelDescriptions.B1, value: 3 },
  { code: "B2", description: levelDescriptions.B2, value: 4 },
] as const;
const emptyContentAdminState: ContentAdminState = {
  auditLog: [],
  defaultAudioConfigured: false,
  importRows: [],
  courses: [],
  scenes: [],
  sentences: [],
};

export function ContentAdminConsole({ module, operatorName }: ContentAdminConsoleProps): JSX.Element {
  const [state, setState] = useState<ContentAdminState>(emptyContentAdminState);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [contentTab, setContentTab] = useState<"scenes" | "courses">("scenes");
  const [statusFilter, setStatusFilter] = useState<ContentStatus | "">("");
  const [audioFilter, setAudioFilter] = useState<AudioStatus | "">("");
  const [sentenceFilters, setSentenceFilters] = useState({ assigned: "", courseId: "", difficulty: "", sceneId: "", sceneTag: "", targetWord: "" });
  const [sceneRows, setSceneRows] = useState<ContentScene[]>([]);
  const [courseRows, setCourseRows] = useState<ContentCourse[]>([]);
  const [sentenceRows, setSentenceRows] = useState<ContentSentence[]>([]);
  const [sceneOffset, setSceneOffset] = useState(0);
  const [courseOffset, setCourseOffset] = useState(0);
  const [sentenceOffset, setSentenceOffset] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeCourseId, setActiveCourseId] = useState(state.courses[0]?.courseId ?? "");
  const [bulkAssignCourseId, setBulkAssignCourseId] = useState(state.courses[0]?.courseId ?? "");
  const [dialog, setDialog] = useState<null | { action: ContentStatus; count: number; ids: string[]; target: "scene" | "course" | "sentence" }>(null);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const [selectedSentence, setSelectedSentence] = useState<ContentSentence | null>(null);
  const [editingScene, setEditingScene] = useState<ContentScene | null>(null);
  const [editingCourse, setEditingCourse] = useState<ContentCourse | null>(null);

  const activeCourse = state.courses.find((course) => course.courseId === activeCourseId) ?? state.courses[0] ?? null;
  const listModule = module === "content" ? contentTab : module;

  const loadContentAdmin = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const [scenesResponse, coursesResponse, sentencesResponse, defaultAudio, validation, auditLogs] = await Promise.all([
        adminApi.contentScenes(),
        adminApi.contentCourses(),
        adminApi.contentSentences(),
        adminApi.contentDefaultAudio(),
        adminApi.contentPublishingValidation(),
        adminApi.auditLogs(),
      ]);
      const scenes = scenesResponse.items.map(mapScene);
      const courses = coursesResponse.items.map(mapCourse);
      const sentences = sentencesResponse.items.map(mapSentence);
      setState((current) => ({
        ...current,
        auditLog: auditLogs.items.map(mapAudit),
        defaultAudioConfigured: Boolean(defaultAudio.configured),
        courses,
        scenes,
        sentences,
      }));
      setValidationIssues(mapIssues(validation));
      setActiveCourseId((current) => (courses.some((course) => course.courseId === current) ? current : courses[0]?.courseId ?? ""));
      setBulkAssignCourseId((current) => (courses.some((course) => course.courseId === current) ? current : courses[0]?.courseId ?? ""));
    } catch (caught) {
      setError(readableApiError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContentAdmin();
  }, [loadContentAdmin]);

  const loadSceneList = useCallback(async (offset: number): Promise<void> => {
    setListLoading(true);
    setListError(null);
    try {
      const response = await adminApi.contentScenes({
        keyword,
        limit: listPageSize,
        offset,
        status: statusFilter,
      });
      setSceneRows(response.items.map(mapScene));
      setSceneOffset(offset);
      setSelectedIds([]);
    } catch (caught) {
      setListError(readableApiError(caught));
    } finally {
      setListLoading(false);
    }
  }, [keyword, statusFilter]);

  const loadCourseList = useCallback(async (offset: number): Promise<void> => {
    setListLoading(true);
    setListError(null);
    try {
      const response = await adminApi.contentCourses({
        keyword,
        limit: listPageSize,
        offset,
        status: statusFilter,
      });
      setCourseRows(response.items.map(mapCourse));
      setCourseOffset(offset);
      setSelectedIds([]);
    } catch (caught) {
      setListError(readableApiError(caught));
    } finally {
      setListLoading(false);
    }
  }, [keyword, statusFilter]);

  const loadSentenceList = useCallback(async (offset: number): Promise<void> => {
    const difficultyLevel = Number(sentenceFilters.difficulty);
    setListLoading(true);
    setListError(null);
    try {
      const response = await adminApi.contentSentences({
        assigned: sentenceFilters.assigned === "assigned" ? true : sentenceFilters.assigned === "unassigned" ? false : undefined,
        audioStatus: apiAudioStatus(audioFilter),
        courseId: sentenceFilters.courseId,
        difficultyLevel: Number.isFinite(difficultyLevel) && sentenceFilters.difficulty.trim() ? difficultyLevel : undefined,
        keyword,
        limit: listPageSize,
        offset,
        sceneId: sentenceFilters.sceneId,
        sceneTag: sentenceFilters.sceneTag,
        status: statusFilter,
        targetWord: sentenceFilters.targetWord,
      });
      setSentenceRows(response.items.map(mapSentence));
      setSentenceOffset(offset);
      setSelectedIds([]);
    } catch (caught) {
      setListError(readableApiError(caught));
    } finally {
      setListLoading(false);
    }
  }, [audioFilter, keyword, sentenceFilters, statusFilter]);

  useEffect(() => {
    if (listModule === "scenes") void loadSceneList(0);
    if (listModule === "courses") void loadCourseList(0);
    if (module === "sentences") void loadSentenceList(0);
  }, [listModule, loadCourseList, loadSceneList, loadSentenceList, module]);

  async function refreshActiveList(): Promise<void> {
    if (listModule === "scenes") await loadSceneList(sceneOffset);
    if (listModule === "courses") await loadCourseList(courseOffset);
    if (module === "sentences") await loadSentenceList(sentenceOffset);
  }

  function toggleSelected(id: string): void {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function runBulkAction(): Promise<void> {
    if (!dialog) return;
    setLoading(true);
    setError(null);
    try {
      const result = await adminApi.contentBatchStatus({
        ids: dialog.ids,
        objectType: dialog.target,
        reason: `由 ${operatorName} 在内容后台批量变更`,
        status: dialog.action,
      });
      setBulkResult(mapBulkResult(result));
      setSelectedIds([]);
      setDialog(null);
      await loadContentAdmin();
      await refreshActiveList();
    } catch (caught) {
      setError(readableApiError(caught));
    } finally {
      setLoading(false);
    }
  }

  function createScene(): void {
    const sceneId = `scene-${state.scenes.length + 1}`;
    setEditingScene({
      courseCount: 0,
      createdAt: "刚刚",
      description: "",
      name: "",
      publishedCourseCount: 0,
      sceneId,
      slug: `new-scene-${state.scenes.length + 1}`,
      sortOrder: Math.max(...state.scenes.map((scene) => scene.sortOrder), 0) + 10,
      status: "draft",
      updatedAt: "刚刚",
    });
  }

  function createCourse(): void {
    const sceneId = state.scenes.find((scene) => scene.status !== "archived")?.sceneId ?? state.scenes[0]?.sceneId ?? "";
    const courseId = `course-${state.courses.length + 1}`;
    setEditingCourse({
      courseId,
      createdAt: "刚刚",
      description: "",
      level: "3",
      maxSentenceCount: 8,
      minSentenceCount: 4,
      needsRevalidation: true,
      sceneId,
      slug: `new-course-${state.courses.length + 1}`,
      sortOrder: Math.max(...state.courses.filter((course) => course.sceneId === sceneId).map((course) => course.sortOrder), 0) + 10,
      status: "draft",
      title: "",
      unlockRule: "默认解锁",
      updatedAt: "刚刚",
      validationStatus: "fail",
    });
  }

  async function saveScene(scene: ContentScene): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const exists = state.scenes.some((item) => item.sceneId === scene.sceneId);
      if (exists) await adminApi.contentUpdateScene(scene.sceneId, scenePayload(scene, operatorName));
      else await adminApi.contentCreateScene(scenePayload(scene, operatorName));
      setEditingScene(null);
      await loadContentAdmin();
      await refreshActiveList();
    } catch (caught) {
      setError(readableApiError(caught));
    } finally {
      setLoading(false);
    }
  }

  async function saveCourse(course: ContentCourse): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const exists = state.courses.some((item) => item.courseId === course.courseId);
      if (exists) await adminApi.contentUpdateCourse(course.courseId, coursePayload(course, operatorName));
      else await adminApi.contentCreateCourse(coursePayload(course, operatorName));
      setEditingCourse(null);
      await loadContentAdmin();
      await refreshActiveList();
    } catch (caught) {
      setError(readableApiError(caught));
    } finally {
      setLoading(false);
    }
  }

  async function saveSentence(sentence: ContentSentence): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      await adminApi.contentUpdateSentence(sentence.sentenceId, sentencePayload(sentence, operatorName));
      setSelectedSentence(null);
      await loadContentAdmin();
      await refreshActiveList();
    } catch (caught) {
      setError(readableApiError(caught));
    } finally {
      setLoading(false);
    }
  }

  async function addSentenceToCourse(sentenceId: string): Promise<void> {
    if (!activeCourse) return;
    await saveComposition(activeCourse.courseId, { addSentenceIds: [sentenceId], reason: `由 ${operatorName} 添加句子到课程` });
  }

  async function moveCourseSentence(sentenceId: string, direction: -1 | 1): Promise<void> {
    if (!activeCourse) return;
    const ordered = state.sentences
      .filter((sentence) => sentence.courseId === activeCourse.courseId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const index = ordered.findIndex((sentence) => sentence.sentenceId === sentenceId);
    const swapIndex = index + direction;
    if (!ordered[index] || !ordered[swapIndex]) return;
    const next = [...ordered];
    [next[index], next[swapIndex]] = [next[swapIndex] as ContentSentence, next[index] as ContentSentence];
    await saveComposition(activeCourse.courseId, {
      orderedSentenceIds: next.map((sentence) => sentence.sentenceId),
      reason: `由 ${operatorName} 调整课程句子排序`,
    });
  }

  async function removeFromCourse(sentenceId: string, keepSceneId: boolean): Promise<void> {
    if (!activeCourse) return;
    await saveComposition(activeCourse.courseId, {
      keepSceneIdOnRemove: keepSceneId,
      reason: `由 ${operatorName} 从课程移除句子`,
      removeSentenceIds: [sentenceId],
    });
  }

  async function bulkAssignSelectedSentences(): Promise<void> {
    const targetCourse = state.courses.find((course) => course.courseId === bulkAssignCourseId);
    if (!targetCourse || selectedIds.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const result = await adminApi.contentSaveComposition(targetCourse.courseId, {
        addSentenceIds: selectedIds,
        reason: `由 ${operatorName} 批量分配句子到课程`,
      });
      setBulkResult({ failed: 0, reasons: [], skipped: 0, succeeded: Number(result.sentenceCount ?? selectedIds.length) });
      setSelectedIds([]);
      await loadContentAdmin();
      await refreshActiveList();
    } catch (caught) {
      setError(readableApiError(caught));
    } finally {
      setLoading(false);
    }
  }

  async function saveComposition(courseId: string, body: JsonRecord): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      await adminApi.contentSaveComposition(courseId, body);
      await loadContentAdmin();
      await refreshActiveList();
    } catch (caught) {
      setError(readableApiError(caught));
    } finally {
      setLoading(false);
    }
  }

  async function toggleDefaultAudio(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      await adminApi.contentUpdateDefaultAudio({
        configured: !state.defaultAudioConfigured,
        reason: `由 ${operatorName} 更新默认音频配置`,
      });
      await loadContentAdmin();
      await refreshActiveList();
    } catch (caught) {
      setError(readableApiError(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Stack spacing={2}>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {listError ? <Alert severity="error">{listError}</Alert> : null}
      {loading ? <Alert severity="info">正在同步正式后台接口数据。</Alert> : null}

      {module === "overview" ? <OverviewPanel auditLog={state.auditLog} state={state} issues={validationIssues} /> : null}
      {module === "content" || module === "scenes" || module === "courses" ? (
        <ContentManagementPanel
          activeCourse={activeCourse}
          contentTab={listModule === "courses" ? "courses" : "scenes"}
          courseRows={courseRows}
          courses={state.courses}
          keyword={keyword}
          listLoading={listLoading}
          onAddSentence={addSentenceToCourse}
          onArchiveCourse={(courseId) => setDialog({ action: "archived", count: 1, ids: [courseId], target: "course" })}
          onBulkCourse={(ids, action) => setDialog({ action, count: ids.length, ids, target: "course" })}
          onBulkScene={(ids, action) => setDialog({ action, count: ids.length, ids, target: "scene" })}
          onChangeCourse={setActiveCourseId}
          onChangeTab={(next) => {
            setContentTab(next);
            setSelectedIds([]);
          }}
          onCreateCourse={createCourse}
          onCreateScene={createScene}
          onEditCourse={setEditingCourse}
          onEditScene={setEditingScene}
          onKeywordChange={setKeyword}
          onMoveSentence={moveCourseSentence}
          onOpenSentence={setSelectedSentence}
          onPageCourse={(page) => void loadCourseList((page - 1) * listPageSize)}
          onPageScene={(page) => void loadSceneList((page - 1) * listPageSize)}
          onQueryCourse={() => void loadCourseList(0)}
          onQueryScene={() => void loadSceneList(0)}
          onRemoveSentence={removeFromCourse}
          onSelect={toggleSelected}
          onStatusFilterChange={setStatusFilter}
          sceneOffset={sceneOffset}
          sceneRows={sceneRows}
          courseOffset={courseOffset}
          scenes={state.scenes}
          selectedIds={selectedIds}
          sentences={state.sentences}
          statusFilter={statusFilter}
        />
      ) : null}
      {module === "sentences" ? (
        <SentencePanel
          audioFilter={audioFilter}
          bulkAssignCourseId={bulkAssignCourseId}
          courses={state.courses}
          keyword={keyword}
          loading={listLoading}
          onAudioFilterChange={setAudioFilter}
          onBulk={(ids, action) => setDialog({ action, count: ids.length, ids, target: "sentence" })}
          onBulkAssign={bulkAssignSelectedSentences}
          onBulkAssignCourseChange={setBulkAssignCourseId}
          onKeywordChange={setKeyword}
          onOpen={setSelectedSentence}
          onPageChange={(page) => void loadSentenceList((page - 1) * listPageSize)}
          onQuery={() => void loadSentenceList(0)}
          onSelect={toggleSelected}
          onSentenceFiltersChange={(next) => setSentenceFilters((current) => ({ ...current, ...next }))}
          onStatusFilterChange={setStatusFilter}
          scenes={state.scenes}
          selectedIds={selectedIds}
          sentenceFilters={sentenceFilters}
          offset={sentenceOffset}
          sentences={sentenceRows}
          statusFilter={statusFilter}
        />
      ) : null}
      {module === "imports" ? <ImportPanel rows={state.importRows} /> : null}
      {module === "composition" ? (
        <CompositionPanel
          activeCourse={activeCourse}
          courses={state.courses}
          onAdd={addSentenceToCourse}
          onArchiveCourse={(courseId) => setDialog({ action: "archived", count: 1, ids: [courseId], target: "course" })}
          onChangeCourse={setActiveCourseId}
          onCreateCourse={createCourse}
          onCreateScene={createScene}
          onEditCourse={setEditingCourse}
          onOpenSentence={setSelectedSentence}
          onMove={moveCourseSentence}
          onRemove={removeFromCourse}
          scenes={state.scenes}
          sentences={state.sentences}
        />
      ) : null}
      {module === "publishing" ? (
        <PublishingPanel defaultAudioConfigured={state.defaultAudioConfigured} issues={validationIssues} onToggleDefaultAudio={toggleDefaultAudio} />
      ) : null}

      {bulkResult ? <BulkResultPanel result={bulkResult} /> : null}
      {selectedSentence ? <SentenceDetailDialog onClose={() => setSelectedSentence(null)} onSave={saveSentence} sentence={selectedSentence} /> : null}
      {editingScene ? <SceneEditDialog onClose={() => setEditingScene(null)} onSave={saveScene} scene={editingScene} /> : null}
      {editingCourse ? <CourseEditDialog course={editingCourse} onClose={() => setEditingCourse(null)} onSave={saveCourse} scenes={state.scenes} /> : null}
      <Dialog onClose={() => setDialog(null)} open={Boolean(dialog)}>
        <DialogTitle>确认批量状态变更</DialogTitle>
        <DialogContent>
          <Typography>本次将处理 {dialog?.count ?? 0} 个对象，目标状态为 {dialog?.action}。不可操作对象会跳过并返回原因。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)}>取消</Button>
          <Button onClick={runBulkAction} startIcon={<CheckCircleIcon />} variant="contained">
            确认执行
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function OverviewPanel({ auditLog, issues, state }: { auditLog: AuditEntry[]; issues: ValidationIssue[]; state: ContentAdminState }): JSX.Element {
  const metrics = [
    { label: "场景", value: state.scenes.length },
    { label: "课程", value: state.courses.length },
    { label: "未分配句子", value: state.sentences.filter((sentence) => !sentence.courseId).length },
    { label: "可发布课程", value: state.courses.filter((course) => course.validationStatus !== "fail" && course.status !== "archived").length },
    { label: "发布阻断项", value: issues.filter((issue) => issue.severity === "blocking").length },
  ];
  return (
    <Stack spacing={2}>
      <Box className="adminMetricGrid">
        {metrics.map((metric) => (
          <Card className="primaryPanel" key={metric.label}>
            <CardContent>
              <Typography color="text.secondary">{metric.label}</Typography>
              <Typography variant="h4">{metric.value}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>
      <Card className="primaryPanel">
        <CardContent>
          <Typography variant="h6">任务结果</Typography>
          <Typography color="text.secondary">批量操作、导入和发布校验都会返回成功、失败、跳过与对象级原因。</Typography>
          <IssueTable issues={issues.slice(0, 5)} />
        </CardContent>
      </Card>
      <Card className="primaryPanel">
        <CardContent>
          <Typography variant="h6">最近审计</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>时间</TableCell>
                <TableCell>操作者</TableCell>
                <TableCell>对象</TableCell>
                <TableCell>摘要</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {auditLog.slice(0, 5).map((entry) => (
                <TableRow key={entry.auditId}>
                  <TableCell>{entry.createdAt}</TableCell>
                  <TableCell>{entry.actor}</TableCell>
                  <TableCell>{entry.objectType}:{entry.objectId}</TableCell>
                  <TableCell>{entry.summary}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Stack>
  );
}

function ContentManagementPanel(props: {
  activeCourse: ContentCourse | null;
  contentTab: "scenes" | "courses";
  courseOffset: number;
  courseRows: ContentCourse[];
  courses: ContentCourse[];
  keyword: string;
  listLoading: boolean;
  onAddSentence: (sentenceId: string) => Promise<void>;
  onArchiveCourse: (courseId: string) => void;
  onBulkCourse: (ids: string[], action: ContentStatus) => void;
  onBulkScene: (ids: string[], action: ContentStatus) => void;
  onChangeCourse: (courseId: string) => void;
  onChangeTab: (tab: "scenes" | "courses") => void;
  onCreateCourse: () => void;
  onCreateScene: () => void;
  onEditCourse: (course: ContentCourse) => void;
  onEditScene: (scene: ContentScene) => void;
  onKeywordChange: (value: string) => void;
  onMoveSentence: (sentenceId: string, direction: -1 | 1) => void;
  onOpenSentence: (sentence: ContentSentence) => void;
  onPageCourse: (page: number) => void;
  onPageScene: (page: number) => void;
  onQueryCourse: () => void;
  onQueryScene: () => void;
  onRemoveSentence: (sentenceId: string, keepSceneId: boolean) => void;
  onSelect: (id: string) => void;
  onStatusFilterChange: (value: ContentStatus | "") => void;
  sceneOffset: number;
  sceneRows: ContentScene[];
  scenes: ContentScene[];
  selectedIds: string[];
  sentences: ContentSentence[];
  statusFilter: ContentStatus | "";
}): JSX.Element {
  return (
    <Stack spacing={2}>
      <Card className="primaryPanel">
        <CardContent>
          <Tabs onChange={(_, value: "scenes" | "courses") => props.onChangeTab(value)} value={props.contentTab} variant="scrollable">
            <Tab label="场景" value="scenes" />
            <Tab label="课程" value="courses" />
          </Tabs>
        </CardContent>
      </Card>
      {props.contentTab === "scenes" ? (
        <ScenePanel
          keyword={props.keyword}
          loading={props.listLoading}
          offset={props.sceneOffset}
          onBulk={props.onBulkScene}
          onCreate={props.onCreateScene}
          onEdit={props.onEditScene}
          onKeywordChange={props.onKeywordChange}
          onPageChange={props.onPageScene}
          onQuery={props.onQueryScene}
          onSelect={props.onSelect}
          onStatusFilterChange={props.onStatusFilterChange}
          scenes={props.sceneRows}
          selectedIds={props.selectedIds}
          statusFilter={props.statusFilter}
        />
      ) : (
        <>
          <CoursePanel
            courses={props.courseRows}
            keyword={props.keyword}
            loading={props.listLoading}
            offset={props.courseOffset}
            onBulk={props.onBulkCourse}
            onCreate={props.onCreateCourse}
            onEdit={props.onEditCourse}
            onKeywordChange={props.onKeywordChange}
            onPageChange={props.onPageCourse}
            onQuery={props.onQueryCourse}
            onSelect={props.onSelect}
            onStatusFilterChange={props.onStatusFilterChange}
            scenes={props.scenes}
            selectedIds={props.selectedIds}
            sentences={props.sentences}
            statusFilter={props.statusFilter}
          />
          <CompositionPanel
            activeCourse={props.activeCourse}
            courses={props.courses}
            onAdd={props.onAddSentence}
            onArchiveCourse={props.onArchiveCourse}
            onChangeCourse={props.onChangeCourse}
            onCreateCourse={props.onCreateCourse}
            onCreateScene={props.onCreateScene}
            onEditCourse={props.onEditCourse}
            onOpenSentence={props.onOpenSentence}
            onMove={props.onMoveSentence}
            onRemove={props.onRemoveSentence}
            scenes={props.scenes}
            sentences={props.sentences}
          />
        </>
      )}
    </Stack>
  );
}

function ScenePanel(props: {
  keyword: string;
  loading: boolean;
  onBulk: (ids: string[], action: ContentStatus) => void;
  onCreate: () => void;
  onEdit: (scene: ContentScene) => void;
  onKeywordChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onQuery: () => void;
  onSelect: (id: string) => void;
  onStatusFilterChange: (value: ContentStatus | "") => void;
  offset: number;
  scenes: ContentScene[];
  selectedIds: string[];
  statusFilter: ContentStatus | "";
}): JSX.Element {
  const rows = props.scenes;
  return (
    <Card className="primaryPanel">
      <CardContent>
        <ListToolbar keyword={props.keyword} loading={props.loading} onBulk={props.onBulk} onCreate={props.onCreate} onKeywordChange={props.onKeywordChange} onQuery={props.onQuery} onStatusFilterChange={props.onStatusFilterChange} selectedIds={props.selectedIds} statusFilter={props.statusFilter} title="场景管理" />
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" />
              <TableCell>名称</TableCell>
              <TableCell>slug</TableCell>
              <TableCell>课程</TableCell>
              <TableCell>排序</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>更新时间</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((scene) => (
              <SceneRow key={scene.sceneId} onEdit={props.onEdit} onSelect={props.onSelect} scene={scene} selected={props.selectedIds.includes(scene.sceneId)} />
            ))}
          </TableBody>
        </Table>
        <PaginationControls itemCount={rows.length} limit={listPageSize} loading={props.loading} offset={props.offset} onPageChange={props.onPageChange} />
      </CardContent>
    </Card>
  );
}

function SceneRow({ onEdit, onSelect, scene, selected }: { onEdit: (scene: ContentScene) => void; onSelect: (id: string) => void; scene: ContentScene; selected: boolean }): JSX.Element {
  return (
    <TableRow hover>
      <TableCell padding="checkbox"><Checkbox checked={selected} onChange={() => onSelect(scene.sceneId)} /></TableCell>
      <TableCell>{scene.name}</TableCell>
      <TableCell>{scene.slug}</TableCell>
      <TableCell>{scene.publishedCourseCount}/{scene.courseCount}</TableCell>
      <TableCell>{scene.sortOrder}</TableCell>
      <TableCell><StatusChip status={scene.status} /></TableCell>
      <TableCell>{scene.updatedAt}</TableCell>
      <TableCell><Button onClick={() => onEdit(scene)} size="small">编辑</Button></TableCell>
    </TableRow>
  );
}

function CoursePanel(props: {
  courses: ContentCourse[];
  keyword: string;
  loading: boolean;
  onBulk: (ids: string[], action: ContentStatus) => void;
  onCreate: () => void;
  onEdit: (course: ContentCourse) => void;
  onKeywordChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onQuery: () => void;
  onSelect: (id: string) => void;
  onStatusFilterChange: (value: ContentStatus | "") => void;
  offset: number;
  scenes: ContentScene[];
  selectedIds: string[];
  sentences: ContentSentence[];
  statusFilter: ContentStatus | "";
}): JSX.Element {
  const rows = props.courses;
  return (
    <Card className="primaryPanel">
      <CardContent>
        <ListToolbar keyword={props.keyword} loading={props.loading} onBulk={props.onBulk} onCreate={props.onCreate} onKeywordChange={props.onKeywordChange} onQuery={props.onQuery} onStatusFilterChange={props.onStatusFilterChange} selectedIds={props.selectedIds} statusFilter={props.statusFilter} title="课程管理" />
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" />
              <TableCell>标题</TableCell>
              <TableCell>场景</TableCell>
              <TableCell>level</TableCell>
              <TableCell>实际句子</TableCell>
              <TableCell>句子数规则</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>校验</TableCell>
              <TableCell>更新时间</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((course) => (
              <CourseRow
                course={course}
                key={course.courseId}
                onEdit={props.onEdit}
                onSelect={props.onSelect}
                scenes={props.scenes}
                selected={props.selectedIds.includes(course.courseId)}
                sentenceCount={props.sentences.filter((sentence) => sentence.courseId === course.courseId).length}
              />
            ))}
          </TableBody>
        </Table>
        <PaginationControls itemCount={rows.length} limit={listPageSize} loading={props.loading} offset={props.offset} onPageChange={props.onPageChange} />
      </CardContent>
    </Card>
  );
}

function CourseRow({ course, onEdit, onSelect, scenes, selected, sentenceCount }: { course: ContentCourse; onEdit: (course: ContentCourse) => void; onSelect: (id: string) => void; scenes: ContentScene[]; selected: boolean; sentenceCount: number }): JSX.Element {
  return (
    <TableRow hover>
      <TableCell padding="checkbox"><Checkbox checked={selected} onChange={() => onSelect(course.courseId)} /></TableCell>
      <TableCell>{course.title}</TableCell>
      <TableCell>{scenes.find((scene) => scene.sceneId === course.sceneId)?.name ?? course.sceneId}</TableCell>
      <TableCell>{levelLabel(course.level)}</TableCell>
      <TableCell>{sentenceCount}</TableCell>
      <TableCell>{course.minSentenceCount}-{course.maxSentenceCount} 句</TableCell>
      <TableCell><StatusChip status={course.status} /></TableCell>
      <TableCell><Chip color={course.validationStatus === "pass" ? "success" : course.validationStatus === "warning" ? "warning" : "error"} label={course.needsRevalidation ? "需重新校验" : course.validationStatus} size="small" /></TableCell>
      <TableCell>{course.updatedAt}</TableCell>
      <TableCell><Button onClick={() => onEdit(course)} size="small">编辑</Button></TableCell>
    </TableRow>
  );
}

function SentencePanel(props: {
  audioFilter: AudioStatus | "";
  bulkAssignCourseId: string;
  courses: ContentCourse[];
  keyword: string;
  loading: boolean;
  onAudioFilterChange: (value: AudioStatus | "") => void;
  onBulk: (ids: string[], action: ContentStatus) => void;
  onBulkAssign: () => void;
  onBulkAssignCourseChange: (courseId: string) => void;
  onKeywordChange: (value: string) => void;
  onOpen: (sentence: ContentSentence) => void;
  onPageChange: (page: number) => void;
  onQuery: () => void;
  onSelect: (id: string) => void;
  onSentenceFiltersChange: (next: Partial<{ assigned: string; courseId: string; difficulty: string; sceneId: string; sceneTag: string; targetWord: string }>) => void;
  onStatusFilterChange: (value: ContentStatus | "") => void;
  offset: number;
  scenes: ContentScene[];
  selectedIds: string[];
  sentenceFilters: { assigned: string; courseId: string; difficulty: string; sceneId: string; sceneTag: string; targetWord: string };
  sentences: ContentSentence[];
  statusFilter: ContentStatus | "";
}): JSX.Element {
  const rows = props.sentences;
  return (
    <Card className="primaryPanel">
      <CardContent>
        <ListToolbar keyword={props.keyword} loading={props.loading} onBulk={props.onBulk} onKeywordChange={props.onKeywordChange} onQuery={props.onQuery} onStatusFilterChange={props.onStatusFilterChange} selectedIds={props.selectedIds} statusFilter={props.statusFilter} title="句子池" />
        <Box className="sentenceFilterGrid">
          <TextField label="目标词" onChange={(event) => props.onSentenceFiltersChange({ targetWord: event.target.value })} size="small" value={props.sentenceFilters.targetWord} />
          <TextField label="sceneTag" onChange={(event) => props.onSentenceFiltersChange({ sceneTag: event.target.value })} size="small" value={props.sentenceFilters.sceneTag} />
          <TextField label="难度" onChange={(event) => props.onSentenceFiltersChange({ difficulty: event.target.value })} size="small" value={props.sentenceFilters.difficulty} />
          <TextField label="分配状态" onChange={(event) => props.onSentenceFiltersChange({ assigned: event.target.value })} select size="small" value={props.sentenceFilters.assigned}>
            <MenuItem value="">全部</MenuItem>
            <MenuItem value="assigned">已分配课程</MenuItem>
            <MenuItem value="unassigned">未分配课程</MenuItem>
          </TextField>
          <TextField label="音频状态" onChange={(event) => props.onAudioFilterChange(event.target.value as AudioStatus | "")} select size="small" value={props.audioFilter}>
            {audioOptions.map((option) => <MenuItem key={option || "all"} value={option}>{option || "全部音频"}</MenuItem>)}
          </TextField>
          <TextField label="场景" onChange={(event) => props.onSentenceFiltersChange({ sceneId: event.target.value })} select size="small" value={props.sentenceFilters.sceneId}>
            <MenuItem value="">全部场景</MenuItem>
            {props.scenes.map((scene) => <MenuItem key={scene.sceneId} value={scene.sceneId}>{scene.name}</MenuItem>)}
          </TextField>
          <TextField label="课程" onChange={(event) => props.onSentenceFiltersChange({ courseId: event.target.value })} select size="small" value={props.sentenceFilters.courseId}>
            <MenuItem value="">全部课程</MenuItem>
            {props.courses.map((course) => <MenuItem key={course.courseId} value={course.courseId}>{course.title}</MenuItem>)}
          </TextField>
        </Box>
        <Stack direction={{ md: "row", xs: "column" }} spacing={1} sx={{ mb: 1 }}>
          <TextField label="批量分配到课程" onChange={(event) => props.onBulkAssignCourseChange(event.target.value)} select size="small" value={props.bulkAssignCourseId}>
            {props.courses.map((course) => <MenuItem key={course.courseId} value={course.courseId}>{course.title}</MenuItem>)}
          </TextField>
          <Button disabled={props.selectedIds.length === 0} onClick={props.onBulkAssign} variant="outlined">批量分配</Button>
        </Stack>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" />
              <TableCell>句子</TableCell>
              <TableCell>目标词</TableCell>
              <TableCell>归属</TableCell>
              <TableCell>音频</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>引用</TableCell>
              <TableCell>更新时间</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((sentence) => (
              <TableRow hover key={sentence.sentenceId} onDoubleClick={() => props.onOpen(sentence)}>
                <TableCell padding="checkbox"><Checkbox checked={props.selectedIds.includes(sentence.sentenceId)} onChange={() => props.onSelect(sentence.sentenceId)} /></TableCell>
                <TableCell><Button onClick={() => props.onOpen(sentence)}>{sentence.text}</Button></TableCell>
                <TableCell>{sentence.targetWord}</TableCell>
                <TableCell>{sentence.courseId ?? "未分配"}</TableCell>
                <TableCell><AudioChip status={sentence.audioStatus} /></TableCell>
                <TableCell><StatusChip status={sentence.status} /></TableCell>
                <TableCell>{sentence.referenceCount}</TableCell>
                <TableCell>{sentence.updatedAt}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>暂无句子。</TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
        <PaginationControls itemCount={rows.length} limit={listPageSize} loading={props.loading} offset={props.offset} onPageChange={props.onPageChange} />
      </CardContent>
    </Card>
  );
}

function ImportPanel({ rows }: { rows: ImportPreviewRow[] }): JSX.Element {
  return (
    <Card className="primaryPanel">
      <CardContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          批量导入用于把 CSV/JSON 里的英文句子导入“句子池”。每一行通常是一条句子，可带目标词、难度、场景标签、音频 URL、课程归属和排序；导入后再到“课程编排”把句子加入课程。
        </Alert>
        <Stepper activeStep={2} alternativeLabel>
          {importSteps.map((step) => <Step key={step}><StepLabel>{step}</StepLabel></Step>)}
        </Stepper>
        <Box className="adminHelpGrid">
          <Metric label="导入对象" value="句子池句子" />
          <Metric label="支持文件" value="CSV / JSON" />
          <Metric label="预校验内容" value="必填、类型、重复文本、归属和排序冲突" />
        </Box>
        <Stack direction="row" spacing={1} sx={{ my: 2 }}>
          <Button startIcon={<UploadFileIcon />} variant="contained">上传 CSV/JSON</Button>
          <Button startIcon={<FactCheckIcon />} variant="outlined">执行预校验</Button>
          <Button disabled={rows.some((row) => row.severity === "error")} startIcon={<LibraryAddIcon />} variant="outlined">确认导入</Button>
          <Button startIcon={<DownloadIcon />} variant="text">下载失败行</Button>
        </Stack>
        <ImportRowsTable rows={rows} />
      </CardContent>
    </Card>
  );
}

function CompositionPanel(props: {
  activeCourse: ContentCourse | null;
  courses: ContentCourse[];
  onAdd: (sentenceId: string) => Promise<void>;
  onArchiveCourse: (courseId: string) => void;
  onChangeCourse: (courseId: string) => void;
  onCreateCourse: () => void;
  onCreateScene: () => void;
  onEditCourse: (course: ContentCourse) => void;
  onOpenSentence: (sentence: ContentSentence) => void;
  onMove: (sentenceId: string, direction: -1 | 1) => void;
  onRemove: (sentenceId: string, keepSceneId: boolean) => void;
  scenes: ContentScene[];
  sentences: ContentSentence[];
}): JSX.Element {
  const [candidateKeyword, setCandidateKeyword] = useState("");
  const [candidateRows, setCandidateRows] = useState<ContentSentence[]>([]);
  const [candidateOffset, setCandidateOffset] = useState(0);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [candidateError, setCandidateError] = useState<string | null>(null);
  const courseSentences = props.activeCourse
    ? props.sentences.filter((sentence) => sentence.courseId === props.activeCourse?.courseId).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    : [];

  const loadCandidates = useCallback(async (offset: number): Promise<void> => {
    if (!props.activeCourse) {
      setCandidateRows([]);
      setCandidateOffset(0);
      return;
    }
    setCandidateLoading(true);
    setCandidateError(null);
    try {
      const response = await adminApi.contentSentences({
        assigned: false,
        keyword: candidateKeyword,
        limit: listPageSize,
        offset,
        sceneId: props.activeCourse.sceneId,
      });
      setCandidateRows(response.items.map(mapSentence).filter((sentence) => sentence.status !== "archived"));
      setCandidateOffset(offset);
    } catch (caught) {
      setCandidateError(readableApiError(caught));
    } finally {
      setCandidateLoading(false);
    }
  }, [candidateKeyword, props.activeCourse]);

  useEffect(() => {
    void loadCandidates(0);
  }, [loadCandidates]);

  async function addCandidate(sentenceId: string): Promise<void> {
    await props.onAdd(sentenceId);
    await loadCandidates(candidateOffset);
  }
  return (
    <Stack spacing={2}>
      <Card className="primaryPanel">
        <CardContent>
          <Stack direction={{ md: "row", xs: "column" }} spacing={2} sx={{ justifyContent: "space-between" }}>
            <Box>
              <Typography variant="h6">课程编排</Typography>
              <Typography color="text.secondary" variant="body2">查询课程后维护课程句子；新增、编辑和归档课程会调用正式内容后台接口。</Typography>
            </Box>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
              <Button onClick={props.onCreateScene} startIcon={<LibraryAddIcon />} variant="outlined">新建场景</Button>
              <Button disabled={props.scenes.length === 0} onClick={props.onCreateCourse} startIcon={<LibraryAddIcon />} variant="contained">新建课程</Button>
              <Button disabled={!props.activeCourse} onClick={() => props.activeCourse && props.onEditCourse(props.activeCourse)} variant="outlined">编辑课程</Button>
              <Button color="warning" disabled={!props.activeCourse} onClick={() => props.activeCourse && props.onArchiveCourse(props.activeCourse.courseId)} variant="outlined">归档课程</Button>
            </Stack>
          </Stack>
          {props.scenes.length === 0 ? (
            <Alert severity="warning" sx={{ mt: 2 }}>还没有场景。请先新建场景，再创建课程进行编排。</Alert>
          ) : null}
          <Stack direction={{ md: "row", xs: "column" }} spacing={2} sx={{ mt: 2 }}>
            <TextField disabled={props.courses.length === 0} label="查询课程" onChange={(event) => props.onChangeCourse(event.target.value)} select value={props.activeCourse?.courseId ?? ""}>
              {props.courses.length === 0 ? <MenuItem value="">暂无课程</MenuItem> : null}
              {props.courses.map((course) => <MenuItem key={course.courseId} value={course.courseId}>{course.title}</MenuItem>)}
            </TextField>
            <Metric label="所属场景" value={props.activeCourse ? props.scenes.find((scene) => scene.sceneId === props.activeCourse?.sceneId)?.name ?? "-" : "-"} />
            <Metric label="句子数规则" value={props.activeCourse ? `${props.activeCourse.minSentenceCount}-${props.activeCourse.maxSentenceCount}` : "-"} />
            <Metric label="当前句子数" value={String(courseSentences.length)} />
          </Stack>
          {props.scenes.length > 0 && props.courses.length === 0 ? (
            <Alert severity="info" sx={{ mt: 2 }}>当前没有课程。点击“新建课程”创建一条课程后，就可以从句子池添加句子。</Alert>
          ) : null}
        </CardContent>
      </Card>
      <Box className="compositionGrid">
        <CompositionList
          buttonLabel="添加"
          candidateError={candidateError}
          candidateLoading={candidateLoading}
          disabled={!props.activeCourse}
          emptyText={props.activeCourse ? "暂无可添加的句子。" : "请先选择或创建课程。"}
          keyword={candidateKeyword}
          offset={candidateOffset}
          onAction={addCandidate}
          onKeywordChange={setCandidateKeyword}
          onOpen={props.onOpenSentence}
          onPageChange={(page) => void loadCandidates((page - 1) * listPageSize)}
          onQuery={() => void loadCandidates(0)}
          rows={candidateRows}
          title="句子池候选"
        />
        <Card className="primaryPanel">
          <CardContent>
            <Typography variant="h6">课程句子列表</Typography>
            {!props.activeCourse ? <Alert severity="info" sx={{ mt: 1 }}>请先选择或创建课程。</Alert> : null}
            {courseSentences.map((sentence) => (
              <Stack direction="row" key={sentence.sentenceId} spacing={1} sx={{ alignItems: "center", borderBottom: "1px solid #e2e8f0", py: 1 }}>
                <Typography sx={{ width: 32 }}>{sentence.sortOrder}</Typography>
                <Box sx={{ flex: 1 }}>
                  <Typography>{sentence.text}</Typography>
                  <Typography color="text.secondary" variant="body2">{sentence.targetWord} · {sentence.difficulty} · {sentence.audioStatus}</Typography>
                </Box>
                <Button onClick={() => props.onOpenSentence(sentence)} size="small">编辑</Button>
                <Button onClick={() => props.onMove(sentence.sentenceId, -1)} size="small">上移</Button>
                <Button onClick={() => props.onMove(sentence.sentenceId, 1)} size="small">下移</Button>
                <Button color="warning" onClick={() => props.onRemove(sentence.sentenceId, true)} size="small">移除</Button>
              </Stack>
            ))}
            {props.activeCourse && courseSentences.length === 0 ? <Alert severity="warning" sx={{ mt: 1 }}>当前课程还没有句子。请从左侧句子池候选中添加。</Alert> : null}
          </CardContent>
        </Card>
      </Box>
    </Stack>
  );
}

function PublishingPanel({ defaultAudioConfigured, issues, onToggleDefaultAudio }: { defaultAudioConfigured: boolean; issues: ValidationIssue[]; onToggleDefaultAudio: () => void }): JSX.Element {
  const blockingCount = issues.filter((issue) => issue.severity === "blocking").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  return (
    <Card className="primaryPanel">
      <CardContent>
        <Stack direction={{ md: "row", xs: "column" }} spacing={2} sx={{ justifyContent: "space-between" }}>
          <Box>
            <Typography variant="h6">发布校验</Typography>
            <Typography color="text.secondary">发布前检查场景、课程和句子是否可以进入学习端。红色阻断项必须修复；黄色提示项可发布但需要确认风险。</Typography>
          </Box>
          <FormControlLabel control={<Checkbox checked={defaultAudioConfigured} onChange={onToggleDefaultAudio} />} label="默认音频已配置" />
        </Stack>
        <Box className="adminHelpGrid">
          <Metric label="怎么用" value="先看阻断原因，再到修复入口处理" />
          <Metric label="阻断项" value={`${blockingCount} 个`} />
          <Metric label="提示项" value={`${warningCount} 个`} />
        </Box>
        <Alert severity="info" sx={{ mt: 2 }}>
          典型流程：在课程编排完成后进入本页；若没有阻断项，执行发布/批量发布；若有阻断项，按“修复入口”回到场景、课程、句子或编排页处理。
        </Alert>
        <IssueTable issues={issues} />
      </CardContent>
    </Card>
  );
}

function ListToolbar({ keyword, loading, onBulk, onCreate, onKeywordChange, onQuery, onStatusFilterChange, selectedIds, statusFilter, title }: {
  keyword: string;
  loading: boolean;
  onBulk: (ids: string[], action: ContentStatus) => void;
  onCreate?: () => void;
  onKeywordChange: (value: string) => void;
  onQuery: () => void;
  onStatusFilterChange: (value: ContentStatus | "") => void;
  selectedIds: string[];
  statusFilter: ContentStatus | "";
  title: string;
}): JSX.Element {
  return (
    <Stack spacing={2} sx={{ mb: 2 }}>
      <Stack direction={{ md: "row", xs: "column" }} spacing={1} sx={{ justifyContent: "space-between" }}>
        <Typography variant="h6">{title}</Typography>
        <Stack direction="row" spacing={1}>
          {onCreate ? <Button onClick={onCreate} startIcon={<LibraryAddIcon />} variant="contained">新建</Button> : null}
          <Button disabled={selectedIds.length === 0} onClick={() => onBulk(selectedIds, "published")} startIcon={<PublishIcon />} variant="outlined">发布</Button>
          <Button disabled={selectedIds.length === 0} onClick={() => onBulk(selectedIds, "unpublished")} variant="outlined">下架</Button>
          <Button disabled={selectedIds.length === 0} onClick={() => onBulk(selectedIds, "archived")} startIcon={<ArchiveIcon />} variant="outlined">归档</Button>
          <Button disabled={selectedIds.length === 0} onClick={() => onBulk(selectedIds, "draft")} startIcon={<RestoreIcon />} variant="outlined">恢复草稿</Button>
        </Stack>
      </Stack>
      <Stack direction={{ md: "row", xs: "column" }} spacing={1}>
        <TextField label="关键词" onChange={(event) => onKeywordChange(event.target.value)} size="small" value={keyword} />
        <TextField label="状态" onChange={(event) => onStatusFilterChange(event.target.value as ContentStatus | "")} select size="small" value={statusFilter}>
          <MenuItem value="">全部状态</MenuItem>
          {statusOptions.map((status) => <MenuItem key={status} value={status}>{statusText(status)}</MenuItem>)}
        </TextField>
        <Button disabled={loading} onClick={onQuery} size="small" variant="contained">查询 / 刷新</Button>
        <Chip label={`已选择 ${selectedIds.length}`} />
      </Stack>
    </Stack>
  );
}

function PaginationControls({
  itemCount,
  limit,
  loading,
  offset,
  onPageChange,
}: {
  itemCount: number;
  limit: number;
  loading: boolean;
  offset: number;
  onPageChange: (page: number) => void;
}): JSX.Element {
  const page = Math.floor(offset / limit) + 1;
  const [jumpPage, setJumpPage] = useState(String(page));

  useEffect(() => {
    setJumpPage(String(page));
  }, [page]);

  function jump(): void {
    onPageChange(Math.max(1, Number(jumpPage) || page));
  }

  return (
    <Box className="paginationControls">
      <Typography color="text.secondary" variant="body2">第 {page} 页 · 当前 {itemCount} 条 · 每页 {limit} 条</Typography>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
        <Button disabled={loading || page <= 1} onClick={() => onPageChange(page - 1)} size="small" variant="outlined">上一页</Button>
        <Button disabled={loading || itemCount < limit} onClick={() => onPageChange(page + 1)} size="small" variant="outlined">下一页</Button>
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

function SentenceDetailDialog({ onClose, onSave, sentence }: { onClose: () => void; onSave: (sentence: ContentSentence) => void; sentence: ContentSentence }): JSX.Element {
  const [draft, setDraft] = useState(sentence);
  return (
    <Dialog fullWidth maxWidth="md" onClose={onClose} open>
      <DialogTitle>句子详情</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="英文文本" multiline onChange={(event) => setDraft({ ...draft, text: event.target.value })} value={draft.text} />
          <TextField label="目标词" onChange={(event) => setDraft({ ...draft, targetWord: event.target.value })} value={draft.targetWord} />
          <TextField label="难度" onChange={(event) => setDraft({ ...draft, difficulty: event.target.value })} value={draft.difficulty} />
          <TextField label="短语块" onChange={(event) => setDraft({ ...draft, phraseChunks: event.target.value.split(",").map((chunk) => chunk.trim()).filter(Boolean) })} value={draft.phraseChunks.join(", ")} />
          <TextField label="场景标签" onChange={(event) => setDraft({ ...draft, sceneTag: event.target.value })} value={draft.sceneTag} />
          <TextField label="音频状态" onChange={(event) => setDraft({ ...draft, audioStatus: event.target.value as AudioStatus })} select value={draft.audioStatus}>
            {audioOptions.filter(Boolean).map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
          </TextField>
          <TextField label="常速音频 URL" onChange={(event) => setDraft({ ...draft, normalAudioUrl: event.target.value || null })} value={draft.normalAudioUrl ?? ""} />
          <TextField label="慢速音频 URL" onChange={(event) => setDraft({ ...draft, slowAudioUrl: event.target.value || null })} value={draft.slowAudioUrl ?? ""} />
          <Alert severity="info">归属：{draft.sceneId ?? "未分配场景"} / {draft.courseId ?? "未分配课程"}。引用数量：{draft.referenceCount}。已被练习引用的句子不可硬删除，只能下架或归档。</Alert>
          <Alert severity="warning">修改句子文本可能影响目标词、短语块、音频和练习记录解释。</Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={() => onSave(draft)} startIcon={<SaveIcon />} variant="contained">保存</Button>
      </DialogActions>
    </Dialog>
  );
}

function SceneEditDialog({ onClose, onSave, scene }: { onClose: () => void; onSave: (scene: ContentScene) => void; scene: ContentScene }): JSX.Element {
  const [draft, setDraft] = useState(scene);
  return (
    <Dialog fullWidth maxWidth="sm" onClose={onClose} open>
      <DialogTitle>{scene.name ? "编辑场景" : "新建场景"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="场景名称" onChange={(event) => setDraft({ ...draft, name: event.target.value })} value={draft.name} />
          <TextField label="URL 标识" onChange={(event) => setDraft({ ...draft, slug: event.target.value })} value={draft.slug} />
          <TextField label="描述" multiline onChange={(event) => setDraft({ ...draft, description: event.target.value })} value={draft.description} />
          <TextField label="学习端展示排序" onChange={(event) => setDraft({ ...draft, sortOrder: Number(event.target.value) })} type="number" value={draft.sortOrder} />
          <TextField label="状态" onChange={(event) => setDraft({ ...draft, status: event.target.value as ContentStatus })} select value={draft.status}>
            {statusOptions.map((status) => <MenuItem key={status} value={status}>{statusText(status)}</MenuItem>)}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button disabled={!draft.name.trim() || !draft.slug.trim()} onClick={() => onSave(draft)} startIcon={<SaveIcon />} variant="contained">保存</Button>
      </DialogActions>
    </Dialog>
  );
}

function CourseEditDialog({ course, onClose, onSave, scenes }: { course: ContentCourse; onClose: () => void; onSave: (course: ContentCourse) => void; scenes: ContentScene[] }): JSX.Element {
  const [draft, setDraft] = useState(course);
  return (
    <Dialog fullWidth maxWidth="md" onClose={onClose} open>
      <DialogTitle>{course.title ? "编辑课程" : "新建课程"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="课程标题" onChange={(event) => setDraft({ ...draft, title: event.target.value })} value={draft.title} />
          <TextField label="URL 标识" onChange={(event) => setDraft({ ...draft, slug: event.target.value })} value={draft.slug} />
          <TextField label="所属场景" onChange={(event) => setDraft({ ...draft, sceneId: event.target.value })} select value={draft.sceneId}>
            {scenes.map((scene) => <MenuItem key={scene.sceneId} value={scene.sceneId}>{scene.name}</MenuItem>)}
          </TextField>
          <TextField label="适合学习者水平" onChange={(event) => setDraft({ ...draft, level: event.target.value })} select value={draft.level}>
            {levelOptions.map((option) => <MenuItem key={option.code} value={String(option.value)}>{option.code} - {option.description}</MenuItem>)}
          </TextField>
          <TextField label="描述" multiline onChange={(event) => setDraft({ ...draft, description: event.target.value })} value={draft.description} />
          <Stack direction={{ md: "row", xs: "column" }} spacing={1}>
            <TextField label="最少句子数" onChange={(event) => setDraft({ ...draft, minSentenceCount: Number(event.target.value) })} type="number" value={draft.minSentenceCount} />
            <TextField label="最多句子数" onChange={(event) => setDraft({ ...draft, maxSentenceCount: Number(event.target.value) })} type="number" value={draft.maxSentenceCount} />
            <TextField label="排序" onChange={(event) => setDraft({ ...draft, sortOrder: Number(event.target.value) })} type="number" value={draft.sortOrder} />
          </Stack>
          <TextField label="解锁规则" onChange={(event) => setDraft({ ...draft, unlockRule: event.target.value })} value={draft.unlockRule} />
          <TextField label="状态" onChange={(event) => setDraft({ ...draft, status: event.target.value as ContentStatus })} select value={draft.status}>
            {statusOptions.map((status) => <MenuItem key={status} value={status}>{statusText(status)}</MenuItem>)}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button disabled={!draft.title.trim() || !draft.slug.trim()} onClick={() => onSave(draft)} startIcon={<SaveIcon />} variant="contained">保存</Button>
      </DialogActions>
    </Dialog>
  );
}

function BulkResultPanel({ result }: { result: BulkResult }): JSX.Element {
  return (
    <Alert severity={result.failed > 0 ? "warning" : "success"}>
      成功 {result.succeeded}，失败 {result.failed}，跳过 {result.skipped}
      {result.reasons.length > 0 ? `：${result.reasons.map((item) => `${item.id} ${item.reason}`).join("；")}` : ""}
    </Alert>
  );
}

function CompositionList({
  buttonLabel,
  candidateError,
  candidateLoading,
  disabled,
  emptyText,
  keyword,
  offset,
  onAction,
  onKeywordChange,
  onOpen,
  onPageChange,
  onQuery,
  rows,
  title,
}: {
  buttonLabel: string;
  candidateError: string | null;
  candidateLoading: boolean;
  disabled?: boolean;
  emptyText: string;
  keyword: string;
  offset: number;
  onAction: (id: string) => Promise<void>;
  onKeywordChange: (value: string) => void;
  onOpen: (sentence: ContentSentence) => void;
  onPageChange: (page: number) => void;
  onQuery: () => void;
  rows: ContentSentence[];
  title: string;
}): JSX.Element {
  return (
    <Card className="primaryPanel">
      <CardContent>
        <Stack direction={{ md: "row", xs: "column" }} spacing={1} sx={{ justifyContent: "space-between", mb: 1 }}>
          <Typography variant="h6">{title}</Typography>
          <Stack direction="row" spacing={1}>
            <TextField label="查询句子 / 目标词" onChange={(event) => onKeywordChange(event.target.value)} size="small" value={keyword} />
            <Button disabled={candidateLoading || disabled} onClick={onQuery} size="small" variant="contained">查询</Button>
          </Stack>
        </Stack>
        {candidateError ? <Alert severity="error" sx={{ mb: 1 }}>{candidateError}</Alert> : null}
        {rows.map((sentence) => (
          <Stack direction="row" key={sentence.sentenceId} spacing={1} sx={{ alignItems: "center", borderBottom: "1px solid #e2e8f0", py: 1 }}>
            <Box sx={{ flex: 1 }}>
              <Typography>{sentence.text}</Typography>
              <Typography color="text.secondary" variant="body2">{sentence.targetWord} · {sentence.difficulty} · {sentence.audioStatus}</Typography>
            </Box>
            <Button onClick={() => onOpen(sentence)} size="small">编辑</Button>
            <Button disabled={disabled || candidateLoading} onClick={() => void onAction(sentence.sentenceId)} size="small">{buttonLabel}</Button>
          </Stack>
        ))}
        {rows.length === 0 ? <Alert severity="info" sx={{ mt: 1 }}>{emptyText}</Alert> : null}
        <PaginationControls itemCount={rows.length} limit={listPageSize} loading={candidateLoading} offset={offset} onPageChange={onPageChange} />
      </CardContent>
    </Card>
  );
}

function ImportRowsTable({ rows }: { rows: ImportPreviewRow[] }): JSX.Element {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>行</TableCell>
          <TableCell>句子</TableCell>
          <TableCell>目标词</TableCell>
          <TableCell>sceneTag</TableCell>
          <TableCell>结果</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.rowId}>
            <TableCell>{row.rowId}</TableCell>
            <TableCell>{row.sentenceText}</TableCell>
            <TableCell>{row.targetWord}</TableCell>
            <TableCell>{row.sceneTag}</TableCell>
            <TableCell><Chip color={row.severity === "ok" ? "success" : row.severity === "warning" ? "warning" : "error"} label={row.message} size="small" /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function IssueTable({ issues }: { issues: ValidationIssue[] }): JSX.Element {
  if (issues.length === 0) return <Alert severity="success" sx={{ mt: 2 }}>暂无发布阻断项。</Alert>;
  return (
    <Table size="small" sx={{ mt: 2 }}>
      <TableHead>
        <TableRow>
          <TableCell>对象</TableCell>
          <TableCell>级别</TableCell>
          <TableCell>原因</TableCell>
          <TableCell>修复入口</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {issues.map((issue) => (
          <TableRow key={issue.id}>
            <TableCell>{issue.objectName}</TableCell>
            <TableCell><Chip color={issue.severity === "blocking" ? "error" : "warning"} label={issue.severity === "blocking" ? "阻断" : "提示"} size="small" /></TableCell>
            <TableCell>{issue.message}</TableCell>
            <TableCell>{issue.fixTarget}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <Box className="metricBox">
      <Typography color="text.secondary" variant="body2">{label}</Typography>
      <Typography>{value}</Typography>
    </Box>
  );
}

function StatusChip({ status }: { status: ContentStatus }): JSX.Element {
  const color = status === "published" ? "success" : status === "archived" ? "default" : status === "unpublished" ? "warning" : "info";
  return <Chip color={color} label={statusText(status)} size="small" />;
}

function AudioChip({ status }: { status: AudioStatus }): JSX.Element {
  const color = status === "real" ? "success" : status === "default" ? "warning" : "error";
  return <Chip color={color} label={status} size="small" />;
}

function levelLabel(level: string): string {
  const byCode = levelDescriptions[level];
  if (byCode) return `${level} - ${byCode}`;
  const option = levelOptions.find((item) => String(item.value) === String(level));
  return option ? `${option.code} - ${option.description}` : level;
}

function statusText(status: ContentStatus): string {
  if (status === "draft") return "草稿";
  if (status === "published") return "已发布";
  if (status === "unpublished") return "已下架";
  return "已归档";
}

function mapScene(row: JsonRecord): ContentScene {
  return {
    courseCount: numberField(row.courseCount),
    createdAt: textField(row.createdAt),
    description: textField(row.description),
    name: textField(row.name),
    publishedCourseCount: numberField(row.publishedCourseCount),
    sceneId: textField(row.sceneId),
    slug: textField(row.slug),
    sortOrder: numberField(row.sortOrder),
    status: statusField(row.status),
    updatedAt: textField(row.updatedAt),
  };
}

function mapCourse(row: JsonRecord): ContentCourse {
  const validation = recordField(row.validation);
  const issues = arrayField(validation.issues);
  const hasBlocking = issues.some((issue) => recordField(issue).severity === "blocking");
  return {
    courseId: textField(row.courseId),
    createdAt: textField(row.createdAt),
    description: textField(row.description),
    level: textField(row.level),
    maxSentenceCount: numberField(row.maxSentenceCount),
    minSentenceCount: numberField(row.minSentenceCount),
    needsRevalidation: Boolean(row.needsRevalidation),
    sceneId: textField(row.sceneId),
    slug: textField(row.slug),
    sortOrder: numberField(row.sortOrder),
    status: statusField(row.status),
    title: textField(row.title),
    unlockRule: unlockRuleText(row.unlockPolicy),
    updatedAt: textField(row.updatedAt),
    validationStatus: hasBlocking ? "fail" : issues.length > 0 ? "warning" : "pass",
  };
}

function mapSentence(row: JsonRecord): ContentSentence {
  const targetWords = stringArrayField(row.targetWords);
  const sceneTags = stringArrayField(row.sceneTags);
  return {
    audioStatus: audioStatusField(row.audioStatus),
    courseId: nullableTextField(row.courseId),
    createdAt: textField(row.createdAt),
    difficulty: textField(row.difficultyLevel),
    importBatchId: nullableTextField(row.importBatchId),
    normalAudioUrl: nullableTextField(row.normalAudioUrl),
    phraseChunks: stringArrayField(row.phraseChunks),
    referenceCount: numberField(row.referenceCount),
    sceneId: nullableTextField(row.sceneId),
    sceneTag: sceneTags[0] ?? "",
    sentenceId: textField(row.sentenceId),
    slowAudioUrl: nullableTextField(row.slowAudioUrl),
    sortOrder: nullableNumberField(row.sortOrder),
    status: statusField(row.status),
    targetWord: targetWords[0] ?? "",
    text: textField(row.sentenceText),
    updatedAt: textField(row.updatedAt),
  };
}

function mapAudit(row: JsonRecord): AuditEntry {
  const objectType = textField(row.objectType);
  return {
    actionType: auditActionType(row.actionType ?? row.action),
    actor: textField(row.actor ?? row.adminUserId),
    auditId: textField(row.auditId ?? row.id),
    createdAt: textField(row.createdAt),
    objectId: textField(row.objectId),
    objectType: objectType === "scene" || objectType === "course" || objectType === "sentence" || objectType === "import" ? objectType : "sentence",
    summary: textField(row.summary ?? row.actionType ?? row.action),
  };
}

function mapIssues(response: JsonRecord): ValidationIssue[] {
  return arrayField(response.issues).map((item, index) => {
    const row = recordField(item);
    const objectType = textField(row.objectType);
    const severity = row.severity === "warning" ? "warning" : "blocking";
    return {
      fixTarget: fixTargetField(row.fixTarget),
      id: `${textField(row.objectType)}-${textField(row.objectId)}-${textField(row.message)}-${index}`,
      message: validationMessage(textField(row.message)),
      objectId: textField(row.objectId),
      objectName: textField(row.objectName),
      objectType: objectType === "scene" || objectType === "course" || objectType === "sentence" ? objectType : "sentence",
      severity,
    };
  });
}

function scenePayload(scene: ContentScene, operatorName: string): JsonRecord {
  return {
    description: scene.description || null,
    name: scene.name,
    reason: `由 ${operatorName} 保存场景`,
    slug: scene.slug,
    sortOrder: scene.sortOrder,
    status: scene.status,
  };
}

function coursePayload(course: ContentCourse, operatorName: string): JsonRecord {
  return {
    description: course.description || null,
    level: Number(course.level) || 3,
    maxSentenceCount: course.maxSentenceCount,
    minSentenceCount: course.minSentenceCount,
    reason: `由 ${operatorName} 保存课程`,
    sceneId: course.sceneId,
    slug: course.slug,
    sortOrder: course.sortOrder,
    status: course.status,
    title: course.title,
    unlockPolicy: { label: course.unlockRule },
  };
}

function sentencePayload(sentence: ContentSentence, operatorName: string): JsonRecord {
  return {
    audioStatus: sentence.audioStatus === "real" ? "ready" : sentence.audioStatus,
    courseId: sentence.courseId,
    difficultyLevel: Number(sentence.difficulty) || 1,
    normalAudioUrl: sentence.normalAudioUrl,
    phraseChunks: sentence.phraseChunks,
    reason: `由 ${operatorName} 保存句子`,
    sceneId: sentence.sceneId,
    sceneTags: sentence.sceneTag ? [sentence.sceneTag] : [],
    sentenceText: sentence.text,
    slowAudioUrl: sentence.slowAudioUrl,
    sortOrder: sentence.sortOrder ?? 0,
    status: sentence.status,
    targetWords: sentence.targetWord ? [sentence.targetWord] : [],
  };
}

function mapBulkResult(row: JsonRecord): BulkResult {
  const failures = arrayField(row.failures);
  return {
    failed: numberField(row.failed),
    reasons: failures.map((item) => ({ id: textField(recordField(item).id), reason: textField(recordField(item).reason) })),
    skipped: numberField(row.skipped),
    succeeded: numberField(row.succeeded),
  };
}

function readableApiError(caught: unknown): string {
  return caught instanceof Error ? caught.message : "正式后台接口请求失败";
}

function statusField(value: unknown): ContentStatus {
  return value === "published" || value === "unpublished" || value === "archived" ? value : "draft";
}

function audioStatusField(value: unknown): AudioStatus {
  if (value === "ready") return "real";
  if (value === "default" || value === "missing" || value === "unreachable") return value;
  return "missing";
}

function apiAudioStatus(value: AudioStatus | ""): string | undefined {
  if (!value) return undefined;
  return value === "real" ? "ready" : value;
}

function auditActionType(value: unknown): AuditEntry["actionType"] {
  const text = textField(value);
  if (text.includes("import")) return "import";
  if (text.includes("composition")) return "composition_change";
  if (text.includes("status") || text.includes("publish")) return "status_change";
  if (text.includes("create")) return "create";
  if (text.includes("update")) return "update";
  if (text.includes("bulk")) return "bulk_assign";
  return "update";
}

function fixTargetField(value: unknown): ValidationIssue["fixTarget"] {
  return value === "scene" || value === "course" || value === "sentence" || value === "composition" || value === "audio" ? value : "sentence";
}

function validationMessage(code: string): string {
  const messages: Record<string, string> = {
    archived_sentence_cannot_publish: "归档句子不能发布",
    course_sentence_difficulty_must_be_consistent: "课程内句子难度必须一致",
    course_sort_order_must_be_unique_and_continuous: "课程内排序必须连续且唯一",
    default_audio_missing_and_sentence_audio_unavailable: "默认音频未配置且句子缺少可用音频",
    scene_must_be_published: "所属场景未发布，课程不可发布",
    scene_requires_one_publishable_course: "场景发布前至少需要 1 个可发布课程",
    sentence_count_out_of_course_rule: "句子数不符合课程规则",
    sentence_text_required: "句子文本必填",
    sentence_will_use_default_audio: "发布时将使用默认音频兜底",
    target_word_required: "句子缺少目标词",
  };
  return messages[code] ?? code;
}

function unlockRuleText(value: unknown): string {
  const record = recordField(value);
  return textField(record.label || record.type || "默认解锁");
}

function arrayField(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function recordField(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function stringArrayField(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function textField(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") return String(value);
  return "";
}

function nullableTextField(value: unknown): string | null {
  const text = textField(value);
  return text || null;
}

function numberField(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function nullableNumberField(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return numberField(value);
}
