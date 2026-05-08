import { AppError } from "../domain/AppError.js";
import { EntityIdCodec, type EntityId } from "../domain/EntityId.js";
import type { ContentAdminRepository, ContentCourseRow, ContentSceneRow, ContentSentenceRow } from "../repositories/ContentAdminRepository.js";
import type { AdminService, CurrentAdmin } from "./AdminService.js";

export type JsonRecord = Record<string, unknown>;
type ContentStatus = "draft" | "published" | "unpublished" | "archived";
type ValidationSeverity = "blocking" | "warning";

const contentStatuses = ["draft", "published", "unpublished", "archived"] as const;
const audioStatuses = ["missing", "ready", "failed", "default", "unreachable"] as const;
const defaultAudioSettingKey = "default_audio";
const importSettingPrefix = "content_import:";

export class ContentAdminService {
  constructor(
    private readonly repository: ContentAdminRepository,
    private readonly adminService: AdminService,
  ) {}

  async summary(admin: CurrentAdmin): Promise<JsonRecord> {
    this.adminService.assertPermission(admin, "admin.content.read");
    const [scenes, courses, sentences] = await Promise.all([
      this.repository.listScenes({ limit: 100, offset: 0 }),
      this.repository.listCourses({ limit: 100, offset: 0 }),
      this.repository.listSentences({ limit: 100, offset: 0 }),
    ]);
    const validation = await this.validateAll(admin);
    return {
      courseCount: courses.length,
      publishBlockingCount: validation.issues.filter((issue) => issue.severity === "blocking").length,
      publishWarningCount: validation.issues.filter((issue) => issue.severity === "warning").length,
      sceneCount: scenes.length,
      sentenceCount: sentences.length,
      unassignedSentenceCount: sentences.filter((sentence) => !sentence.courseId).length,
    };
  }

  async listScenes(admin: CurrentAdmin, query: Parameters<ContentAdminRepository["listScenes"]>[0]): Promise<JsonRecord[]> {
    this.adminService.assertPermission(admin, "admin.content.read");
    return Promise.all((await this.repository.listScenes(query)).map((row) => this.scene(row)));
  }

  async getScene(admin: CurrentAdmin, id: EntityId): Promise<JsonRecord> {
    this.adminService.assertPermission(admin, "admin.content.read");
    return this.scene(await this.requireScene(id));
  }

  async createScene(admin: CurrentAdmin, input: JsonRecord): Promise<JsonRecord> {
    this.adminService.assertPermission(admin, "admin.content.write");
    const row = await this.repository.createScene({
      description: stringOrNull(input.description),
      name: requiredString(input.name, "name"),
      publishStatus: enumValue(input.status ?? input.publishStatus, contentStatuses, "draft"),
      slug: slugValue(input.slug, requiredString(input.name, "name")),
      sortOrder: numberValue(input.sortOrder, 0),
      updatedByAdminId: admin.adminUserId,
    });
    const output = await this.scene(row);
    await this.audit(admin, "admin.content.write", "content_scene_create", "scene", row.id, undefined, output, stringOrUndefined(input.reason));
    return output;
  }

  async updateScene(admin: CurrentAdmin, id: EntityId, input: JsonRecord): Promise<JsonRecord> {
    this.adminService.assertPermission(admin, "admin.content.write");
    const nextStatus = optionalStatus(input.status ?? input.publishStatus);
    if (nextStatus === "published") await this.assertScenePublishable(id);
    const patch = pickDefined({
      description: nullableString(input.description),
      name: optionalString(input.name),
      publishStatus: nextStatus,
      slug: input.slug === undefined ? undefined : slugValue(input.slug, String(input.name ?? "scene")),
      sortOrder: optionalNumber(input.sortOrder),
      updatedByAdminId: admin.adminUserId,
    });
    const result = await this.repository.updateScene(id, patch as Parameters<ContentAdminRepository["updateScene"]>[1]);
    if (!result?.after) throw new AppError("not_found", "Scene not found");
    const before = await this.scene(result.before);
    const after = await this.scene(result.after);
    await this.audit(admin, "admin.content.write", "content_scene_update", "scene", id, before, after, stringOrUndefined(input.reason));
    return after;
  }

  async listCourses(admin: CurrentAdmin, query: Parameters<ContentAdminRepository["listCourses"]>[0]): Promise<JsonRecord[]> {
    this.adminService.assertPermission(admin, "admin.content.read");
    return Promise.all((await this.repository.listCourses(query)).map((row) => this.course(row)));
  }

  async getCourse(admin: CurrentAdmin, id: EntityId): Promise<JsonRecord> {
    this.adminService.assertPermission(admin, "admin.content.read");
    return this.course(await this.requireCourse(id));
  }

  async createCourse(admin: CurrentAdmin, input: JsonRecord): Promise<JsonRecord> {
    this.adminService.assertPermission(admin, "admin.content.write");
    const title = requiredString(input.title, "title");
    const minSentenceCount = numberValue(input.minSentenceCount, 8);
    const maxSentenceCount = numberValue(input.maxSentenceCount, Math.max(12, minSentenceCount));
    this.assertSentenceCountRule(minSentenceCount, maxSentenceCount);
    const row = await this.repository.createCourse({
      description: stringOrNull(input.description),
      level: numberValue(input.level, 1),
      maxSentenceCount,
      minSentenceCount,
      needsRevalidation: false,
      publishStatus: enumValue(input.status ?? input.publishStatus, contentStatuses, "draft"),
      sceneId: EntityIdCodec.parse(requiredString(input.sceneId, "sceneId")),
      slug: slugValue(input.slug, title),
      sortOrder: numberValue(input.sortOrder, 0),
      title,
      unlockPolicy: recordValue(input.unlockPolicy, { type: "previous_course_completed" }),
      updatedByAdminId: admin.adminUserId,
    });
    const output = await this.course(row);
    await this.audit(admin, "admin.content.write", "content_course_create", "course", row.id, undefined, output, stringOrUndefined(input.reason));
    return output;
  }

  async updateCourse(admin: CurrentAdmin, id: EntityId, input: JsonRecord): Promise<JsonRecord> {
    this.adminService.assertPermission(admin, "admin.content.write");
    const nextStatus = optionalStatus(input.status ?? input.publishStatus);
    if (nextStatus === "published") await this.assertCoursePublishable(id);
    const minSentenceCount = optionalNumber(input.minSentenceCount);
    const maxSentenceCount = optionalNumber(input.maxSentenceCount);
    if (minSentenceCount !== undefined || maxSentenceCount !== undefined) {
      const existing = await this.requireCourse(id);
      this.assertSentenceCountRule(minSentenceCount ?? existing.minSentenceCount, maxSentenceCount ?? existing.maxSentenceCount);
    }
    const patch = pickDefined({
      description: nullableString(input.description),
      level: optionalNumber(input.level),
      maxSentenceCount,
      minSentenceCount,
      needsRevalidation: input.needsRevalidation === undefined ? true : Boolean(input.needsRevalidation),
      publishStatus: nextStatus,
      sceneId: input.sceneId === undefined ? undefined : EntityIdCodec.parse(requiredString(input.sceneId, "sceneId")),
      slug: input.slug === undefined ? undefined : slugValue(input.slug, String(input.title ?? "course")),
      sortOrder: optionalNumber(input.sortOrder),
      title: optionalString(input.title),
      unlockPolicy: optionalRecord(input.unlockPolicy),
      updatedByAdminId: admin.adminUserId,
    });
    const result = await this.repository.updateCourse(id, patch as Parameters<ContentAdminRepository["updateCourse"]>[1]);
    if (!result?.after) throw new AppError("not_found", "Course not found");
    const before = await this.course(result.before);
    const after = await this.course(result.after);
    await this.audit(admin, "admin.content.write", "content_course_update", "course", id, before, after, stringOrUndefined(input.reason));
    return after;
  }

  async listSentences(admin: CurrentAdmin, query: Parameters<ContentAdminRepository["listSentences"]>[0]): Promise<JsonRecord[]> {
    this.adminService.assertPermission(admin, "admin.content.read");
    return (await this.repository.listSentences(query)).map((row) => this.sentence(row));
  }

  async getSentence(admin: CurrentAdmin, id: EntityId): Promise<JsonRecord> {
    this.adminService.assertPermission(admin, "admin.content.read");
    return this.sentence(await this.requireSentence(id));
  }

  async createSentence(admin: CurrentAdmin, input: JsonRecord): Promise<JsonRecord> {
    this.adminService.assertPermission(admin, "admin.content.write");
    const row = await this.repository.createSentence(this.sentenceInput(input, admin.adminUserId));
    const output = this.sentence(row);
    await this.audit(admin, "admin.content.write", "content_sentence_create", "sentence", row.id, undefined, output, stringOrUndefined(input.reason));
    return output;
  }

  async updateSentence(admin: CurrentAdmin, id: EntityId, input: JsonRecord): Promise<JsonRecord> {
    this.adminService.assertPermission(admin, "admin.content.write");
    const patch = this.sentencePatch(input, admin.adminUserId);
    const result = await this.repository.updateSentence(id, patch);
    if (!result?.after) throw new AppError("not_found", "Sentence not found");
    await this.markCourseForRevalidation(result.before.courseId ?? result.after.courseId);
    const before = this.sentence(result.before);
    const after = this.sentence(result.after);
    await this.audit(admin, "admin.content.write", "content_sentence_update", "sentence", id, before, after, stringOrUndefined(input.reason));
    return after;
  }

  async batchStatus(admin: CurrentAdmin, input: JsonRecord): Promise<JsonRecord> {
    this.adminService.assertPermission(admin, "admin.content.publish");
    const objectType = enumValue(input.objectType, ["scene", "course", "sentence"] as const, "sentence");
    const status = enumValue(input.status, contentStatuses, "draft");
    const ids = stringArray(input.ids).map((id) => EntityIdCodec.parse(id));
    const result = { failed: 0, failures: [] as JsonRecord[], skipped: 0, succeeded: 0 };
    for (const id of ids) {
      try {
        await this.changeStatus(admin, objectType, id, status, stringOrUndefined(input.reason));
        result.succeeded += 1;
      } catch (error) {
        result.failed += 1;
        result.failures.push({ id: EntityIdCodec.stringify(id), reason: error instanceof Error ? error.message : "status change failed" });
      }
    }
    return result;
  }

  async saveComposition(admin: CurrentAdmin, courseId: EntityId, input: JsonRecord): Promise<JsonRecord> {
    this.adminService.assertPermission(admin, "admin.content.write");
    const course = await this.requireCourse(courseId);
    const addIds = stringArray(input.addSentenceIds).map((id) => EntityIdCodec.parse(id));
    const removeIds = stringArray(input.removeSentenceIds).map((id) => EntityIdCodec.parse(id));
    const orderedIds = stringArray(input.orderedSentenceIds).map((id) => EntityIdCodec.parse(id));
    let sortOrder = (await this.repository.courseSentenceCount(courseId)) + 1;
    for (const sentenceId of addIds) {
      const sentence = await this.requireSentence(sentenceId);
      if (sentence.publishStatus === "archived") throw new AppError("validation_failed", "Archived sentence cannot be added to a course");
      if (sentence.courseId === courseId) continue;
      await this.repository.updateSentence(sentenceId, { courseId, sceneId: course.sceneId, sortOrder: sortOrder++, updatedByAdminId: admin.adminUserId });
    }
    for (const sentenceId of removeIds) {
      const keepSceneId = input.keepSceneIdOnRemove !== false;
      await this.repository.updateSentence(sentenceId, { courseId: null, sceneId: keepSceneId ? course.sceneId : null, sortOrder: 0, updatedByAdminId: admin.adminUserId });
    }
    for (const [index, sentenceId] of orderedIds.entries()) {
      await this.repository.updateSentence(sentenceId, { courseId, sceneId: course.sceneId, sortOrder: index + 1, updatedByAdminId: admin.adminUserId });
    }
    await this.repository.updateCourse(courseId, { needsRevalidation: true, updatedByAdminId: admin.adminUserId });
    const validation = await this.validateCourse(courseId);
    await this.audit(admin, "admin.content.write", "content_course_composition_save", "course", courseId, undefined, { addIds: input.addSentenceIds, removeIds: input.removeSentenceIds, validation }, stringOrUndefined(input.reason));
    return { courseId: EntityIdCodec.stringify(courseId), sentenceCount: await this.repository.courseSentenceCount(courseId), validation };
  }

  async validateImport(admin: CurrentAdmin, input: JsonRecord): Promise<JsonRecord> {
    this.adminService.assertPermission(admin, "admin.content.write");
    const importInput = this.importInput(input);
    const rows = importInput.rows;
    const results = [];
    for (const [index, row] of rows.entries()) {
      const errors = [];
      const warnings = [];
      const sentenceText = stringOrUndefined(row.sentenceText);
      if (!sentenceText) errors.push("sentenceText is required");
      if (row.difficultyLevel !== undefined && optionalNumber(row.difficultyLevel) === undefined) errors.push("difficultyLevel must be a number");
      if (sentenceText && (await this.repository.findSentenceByText(sentenceText))) warnings.push("duplicate sentence text");
      if (row.courseId && row.sortOrder) {
        const conflicts = await this.repository.sortOrdersInCourse(EntityIdCodec.parse(requiredString(row.courseId, "courseId")), [numberValue(row.sortOrder, 0)]);
        if (conflicts.length > 0) warnings.push("sortOrder conflicts in target course");
      }
      results.push({ errors, rowIndex: index, severity: errors.length > 0 ? "error" : warnings.length > 0 ? "warning" : "ok", warnings });
    }
    const output = {
      canImport: results.every((row) => row.severity !== "error"),
      errorCount: results.filter((row) => row.severity === "error").length,
      importBatchId: importInput.importBatchId,
      results,
      rowCount: rows.length,
      status: results.some((row) => row.severity === "error") ? "failed" : results.some((row) => row.severity === "warning") ? "partial_success" : "success",
      warningCount: results.filter((row) => row.severity === "warning").length,
    };
    await this.repository.upsertSetting(importSettingKey(importInput.importBatchId), { ...output, failedRows: failedImportRows(rows, results), sourceFormat: importInput.sourceFormat, stage: "validated" });
    return output;
  }

  async confirmImport(admin: CurrentAdmin, input: JsonRecord): Promise<JsonRecord> {
    this.adminService.assertPermission(admin, "admin.content.write");
    const importInput = this.importInput(input);
    const validation = await this.validateImport(admin, { ...input, importBatchId: importInput.importBatchId, rows: importInput.rows });
    let created = 0;
    let failed = 0;
    const failures: JsonRecord[] = [];
    const validationResults = Array.isArray(validation.results) ? validation.results : [];
    let updated = 0;
    for (const [index, row] of importInput.rows.entries()) {
      const rowValidation = validationResults[index] as JsonRecord | undefined;
      if (rowValidation?.severity === "error") {
        failed += 1;
        failures.push({ errors: rowValidation.errors ?? ["validation failed"], row, rowIndex: index });
        continue;
      }
      try {
        if (row.sentenceId) {
          await this.updateSentence(admin, EntityIdCodec.parse(requiredString(row.sentenceId, "sentenceId")), { ...row, importBatchId: importInput.importBatchId });
          updated += 1;
        } else {
          await this.createSentence(admin, { ...row, importBatchId: importInput.importBatchId });
          created += 1;
        }
      } catch (error) {
        failed += 1;
        failures.push({ errors: [error instanceof Error ? error.message : "import failed"], row, rowIndex: index });
      }
    }
    const output = {
      created,
      failed,
      failures,
      importBatchId: importInput.importBatchId,
      skipped: 0,
      status: failed === 0 ? "success" : created + updated > 0 ? "partial_success" : "failed",
      updated,
    };
    await this.repository.upsertSetting(importSettingKey(importInput.importBatchId), { ...output, failedRows: failures.map((failure) => failure.row), sourceFormat: importInput.sourceFormat, stage: "confirmed" });
    return output;
  }

  async importResult(admin: CurrentAdmin, importBatchId: string): Promise<JsonRecord> {
    this.adminService.assertPermission(admin, "admin.content.read");
    const result = await this.repository.setting(importSettingKey(importBatchId));
    if (!result) throw new AppError("not_found", "Import result not found");
    return result;
  }

  async importFailureCsv(admin: CurrentAdmin, importBatchId: string): Promise<string> {
    this.adminService.assertPermission(admin, "admin.content.read");
    const result = await this.importResult(admin, importBatchId);
    const rows = arrayRecord(result.failedRows);
    return toCsv(rows);
  }

  async defaultAudio(admin: CurrentAdmin): Promise<JsonRecord> {
    this.adminService.assertPermission(admin, "admin.content.read");
    return (await this.repository.setting(defaultAudioSettingKey)) ?? { configured: false, normalAudioUrl: null, slowAudioUrl: null };
  }

  async updateDefaultAudio(admin: CurrentAdmin, input: JsonRecord): Promise<JsonRecord> {
    this.adminService.assertPermission(admin, "admin.content.write");
    const value = {
      configured: Boolean(input.configured),
      normalAudioUrl: stringOrNull(input.normalAudioUrl),
      slowAudioUrl: stringOrNull(input.slowAudioUrl),
      updatedByAdminId: EntityIdCodec.stringify(admin.adminUserId),
    };
    const output = await this.repository.upsertSetting(defaultAudioSettingKey, value);
    await this.audit(admin, "admin.content.write", "content_default_audio_update", "content_admin_setting", admin.adminUserId, undefined, output, stringOrUndefined(input.reason));
    return output;
  }

  async validateAll(admin: CurrentAdmin): Promise<{ issues: Array<JsonRecord & { severity: ValidationSeverity }> }> {
    this.adminService.assertPermission(admin, "admin.content.read");
    const [scenes, courses, sentences] = await Promise.all([
      this.repository.listScenes({ limit: 1000, offset: 0 }),
      this.repository.listCourses({ limit: 1000, offset: 0 }),
      this.repository.listSentences({ limit: 1000, offset: 0 }),
    ]);
    const issues: Array<JsonRecord & { severity: ValidationSeverity }> = [];
    for (const scene of scenes) issues.push(...(await this.sceneValidationIssues(scene)));
    for (const course of courses) issues.push(...(await this.courseValidationIssues(course)));
    for (const sentence of sentences) issues.push(...(await this.sentenceValidationIssues(sentence)));
    return { issues };
  }

  async validateTarget(admin: CurrentAdmin, input: JsonRecord): Promise<JsonRecord> {
    this.adminService.assertPermission(admin, "admin.content.read");
    const targets = arrayRecord(input.targets);
    if (targets.length > 0) {
      const results = [];
      for (const target of targets) {
        try {
          const validation = await this.validateTarget(admin, target);
          const issues = arrayRecord(validation.issues);
          results.push({ ...target, issues, valid: !issues.some((issue) => issue.severity === "blocking") });
        } catch (error) {
          results.push({ ...target, issues: [{ message: error instanceof Error ? error.message : "validation failed", severity: "blocking" }], valid: false });
        }
      }
      return {
        failed: results.filter((result) => !result.valid).length,
        results,
        succeeded: results.filter((result) => result.valid).length,
      };
    }
    const objectType = enumValue(input.objectType, ["scene", "course", "sentence"] as const, "course");
    const id = EntityIdCodec.parse(requiredString(input.objectId, "objectId"));
    if (objectType === "scene") return { issues: await this.sceneValidationIssues(await this.requireScene(id)) };
    if (objectType === "sentence") return { issues: await this.sentenceValidationIssues(await this.requireSentence(id)) };
    return this.validateCourse(id);
  }

  async publishTarget(admin: CurrentAdmin, input: JsonRecord): Promise<JsonRecord> {
    this.adminService.assertPermission(admin, "admin.content.publish");
    const objectType = enumValue(input.objectType, ["scene", "course", "sentence"] as const, "course");
    const id = EntityIdCodec.parse(requiredString(input.objectId, "objectId"));
    await this.changeStatus(admin, objectType, id, "published", stringOrUndefined(input.reason));
    return { objectId: EntityIdCodec.stringify(id), objectType, status: "published" };
  }

  async validateCourse(courseId: EntityId): Promise<JsonRecord> {
    const issues = await this.courseValidationIssues(await this.requireCourse(courseId));
    return { issues, valid: !issues.some((issue) => issue.severity === "blocking") };
  }

  private async changeStatus(admin: CurrentAdmin, objectType: "scene" | "course" | "sentence", id: EntityId, status: ContentStatus, reason?: string): Promise<void> {
    if (status === "published") {
      if (objectType === "scene") await this.assertScenePublishable(id);
      if (objectType === "course") await this.assertCoursePublishable(id);
      if (objectType === "sentence") await this.assertSentencePublishable(id);
    }
    const current = objectType === "scene" ? await this.requireScene(id) : objectType === "course" ? await this.requireCourse(id) : await this.requireSentence(id);
    if (current.publishStatus === "archived" && status === "published") throw new AppError("validation_failed", "Archived content must be restored to draft before publishing");
    if (objectType === "scene") await this.repository.updateScene(id, { publishStatus: status, updatedByAdminId: admin.adminUserId });
    if (objectType === "course") await this.repository.updateCourse(id, { needsRevalidation: false, publishStatus: status, updatedByAdminId: admin.adminUserId });
    if (objectType === "sentence") await this.repository.updateSentence(id, { publishStatus: status, updatedByAdminId: admin.adminUserId });
    await this.audit(admin, "admin.content.publish", `content_${objectType}_status_${status}`, objectType, id, { publishStatus: current.publishStatus }, { publishStatus: status }, reason);
  }

  private async assertScenePublishable(id: EntityId): Promise<void> {
    const issues = await this.sceneValidationIssues(await this.requireScene(id));
    if (issues.some((issue) => issue.severity === "blocking")) throw new AppError("validation_failed", "Scene is not publishable", { issues });
  }

  private async assertCoursePublishable(id: EntityId): Promise<void> {
    const validation = await this.validateCourse(id);
    if (!validation.valid) throw new AppError("validation_failed", "Course is not publishable", validation);
  }

  private async assertSentencePublishable(id: EntityId): Promise<void> {
    const issues = await this.sentenceValidationIssues(await this.requireSentence(id));
    if (issues.some((issue) => issue.severity === "blocking")) throw new AppError("validation_failed", "Sentence is not publishable", { issues });
  }

  private async sceneValidationIssues(scene: ContentSceneRow): Promise<Array<JsonRecord & { severity: ValidationSeverity }>> {
    const courses = await this.repository.listCourses({ limit: 1000, offset: 0, sceneId: scene.id });
    const publishable = await Promise.all(courses.map((course) => this.courseValidationIssues(course)));
    if (!publishable.some((issues) => !issues.some((issue) => issue.severity === "blocking"))) {
      return [issue("scene", scene.id, scene.name, "blocking", "scene_requires_one_publishable_course", "course")];
    }
    return [];
  }

  private async courseValidationIssues(course: ContentCourseRow): Promise<Array<JsonRecord & { severity: ValidationSeverity }>> {
    const scene = await this.requireScene(course.sceneId);
    const sentences = await this.repository.courseSentences(course.id);
    const issues: Array<JsonRecord & { severity: ValidationSeverity }> = [];
    if (scene.publishStatus !== "published") issues.push(issue("course", course.id, course.title, "blocking", "scene_must_be_published", "scene"));
    if (sentences.length < course.minSentenceCount || sentences.length > course.maxSentenceCount) {
      issues.push(issue("course", course.id, course.title, "blocking", "sentence_count_out_of_course_rule", "composition", { sentenceCount: sentences.length, max: course.maxSentenceCount, min: course.minSentenceCount }));
    }
    const seenSortOrders = new Set<number>();
    for (const [index, sentence] of sentences.entries()) {
      if (sentence.sortOrder !== index + 1 || seenSortOrders.has(sentence.sortOrder)) issues.push(issue("course", course.id, course.title, "blocking", "course_sort_order_must_be_unique_and_continuous", "composition"));
      seenSortOrders.add(sentence.sortOrder);
    }
    const levels = new Set(sentences.map((sentence) => sentence.difficultyLevel));
    if (levels.size > 1) issues.push(issue("course", course.id, course.title, "blocking", "course_sentence_difficulty_must_be_consistent", "sentence"));
    for (const sentence of sentences) issues.push(...(await this.sentenceValidationIssues(sentence)));
    return dedupeIssues(issues);
  }

  private async sentenceValidationIssues(sentence: ContentSentenceRow): Promise<Array<JsonRecord & { severity: ValidationSeverity }>> {
    const issues: Array<JsonRecord & { severity: ValidationSeverity }> = [];
    const defaultAudio = await this.defaultAudioForValidation();
    if (!sentence.sentenceText) issues.push(issue("sentence", sentence.id, sentence.sentenceText, "blocking", "sentence_text_required", "sentence"));
    if (sentence.targetWords.length === 0) issues.push(issue("sentence", sentence.id, sentence.sentenceText, "blocking", "target_word_required", "sentence"));
    if (sentence.publishStatus === "archived") issues.push(issue("sentence", sentence.id, sentence.sentenceText, "blocking", "archived_sentence_cannot_publish", "sentence"));
    const hasRealAudio = Boolean(sentence.normalAudioUrl || sentence.slowAudioUrl) && sentence.audioStatus === "ready";
    if (!hasRealAudio && !defaultAudio.configured) issues.push(issue("sentence", sentence.id, sentence.sentenceText, "blocking", "default_audio_missing_and_sentence_audio_unavailable", "audio"));
    if (!hasRealAudio && defaultAudio.configured) issues.push(issue("sentence", sentence.id, sentence.sentenceText, "warning", "sentence_will_use_default_audio", "audio"));
    return issues;
  }

  private async defaultAudioForValidation(): Promise<{ configured: boolean }> {
    const setting = await this.repository.setting(defaultAudioSettingKey);
    return { configured: Boolean(setting?.configured) };
  }

  private async markCourseForRevalidation(courseId: EntityId | null): Promise<void> {
    if (!courseId) return;
    await this.repository.updateCourse(courseId, { needsRevalidation: true });
  }

  private importInput(input: JsonRecord): { importBatchId: string; rows: JsonRecord[]; sourceFormat: string } {
    const importBatchId = stringValue(input.importBatchId, `import-${Date.now()}`);
    if (Array.isArray(input.rows)) return { importBatchId, rows: arrayRecord(input.rows), sourceFormat: "rows" };
    const rowsText = textValue(input.rows);
    if (rowsText) return { importBatchId, rows: parseImportRows(rowsText), sourceFormat: importFormat(rowsText) };
    const dataText = textValue(input.data);
    if (dataText) return { importBatchId, rows: parseImportRows(dataText), sourceFormat: importFormat(dataText) };
    const fileText = textValue(input.file);
    if (fileText) return { importBatchId, rows: parseImportRows(fileText), sourceFormat: importFormat(fileText) };
    return { importBatchId, rows: [], sourceFormat: "rows" };
  }

  private sentenceInput(input: JsonRecord, adminUserId: EntityId): Omit<ContentSentenceRow, "id" | "createdAt" | "updatedAt"> {
    return {
      audioStatus: enumValue(input.audioStatus, audioStatuses, "missing"),
      bonusWords: stringArray(input.bonusWords),
      courseId: input.courseId ? EntityIdCodec.parse(requiredString(input.courseId, "courseId")) : null,
      difficultyLevel: numberValue(input.difficultyLevel, 1),
      importBatchId: stringOrNull(input.importBatchId),
      normalAudioUrl: stringOrNull(input.normalAudioUrl),
      phraseChunks: stringArray(input.phraseChunks),
      publishStatus: enumValue(input.status ?? input.publishStatus, contentStatuses, "draft"),
      reviewStatus: stringValue(input.reviewStatus, "approved"),
      sceneId: input.sceneId ? EntityIdCodec.parse(requiredString(input.sceneId, "sceneId")) : null,
      sceneTags: stringArray(input.sceneTags),
      sentenceText: requiredString(input.sentenceText, "sentenceText"),
      slowAudioUrl: stringOrNull(input.slowAudioUrl),
      sortOrder: numberValue(input.sortOrder, 0),
      targetWords: stringArray(input.targetWords),
      translationCn: stringOrNull(input.translationCn),
      updatedByAdminId: adminUserId,
    };
  }

  private sentencePatch(input: JsonRecord, adminUserId: EntityId): Partial<Omit<ContentSentenceRow, "id" | "createdAt" | "updatedAt">> {
    return pickDefined({
      audioStatus: input.audioStatus === undefined ? undefined : enumValue(input.audioStatus, audioStatuses, "missing"),
      bonusWords: optionalStringArray(input.bonusWords),
      courseId: input.courseId === undefined ? undefined : input.courseId === null ? null : EntityIdCodec.parse(requiredString(input.courseId, "courseId")),
      difficultyLevel: optionalNumber(input.difficultyLevel),
      importBatchId: nullableString(input.importBatchId),
      normalAudioUrl: nullableString(input.normalAudioUrl),
      phraseChunks: optionalStringArray(input.phraseChunks),
      publishStatus: optionalStatus(input.status ?? input.publishStatus),
      reviewStatus: optionalString(input.reviewStatus),
      sceneId: input.sceneId === undefined ? undefined : input.sceneId === null ? null : EntityIdCodec.parse(requiredString(input.sceneId, "sceneId")),
      sceneTags: optionalStringArray(input.sceneTags),
      sentenceText: optionalString(input.sentenceText),
      slowAudioUrl: nullableString(input.slowAudioUrl),
      sortOrder: optionalNumber(input.sortOrder),
      targetWords: optionalStringArray(input.targetWords),
      translationCn: nullableString(input.translationCn),
      updatedByAdminId: adminUserId,
    }) as Parameters<ContentAdminRepository["updateSentence"]>[1];
  }

  private async scene(row: ContentSceneRow): Promise<JsonRecord> {
    const counts = await this.repository.sceneCourseCounts(row.id);
    return { ...serialize(row, "sceneId"), ...counts, status: row.publishStatus };
  }

  private async course(row: ContentCourseRow): Promise<JsonRecord> {
    const sentenceCount = await this.repository.courseSentenceCount(row.id);
    return { ...serialize(row, "courseId"), sentenceCount, status: row.publishStatus, validation: await this.validateCourse(row.id) };
  }

  private sentence(row: ContentSentenceRow): JsonRecord {
    return { ...serialize(row, "sentenceId"), assigned: Boolean(row.courseId), status: row.publishStatus };
  }

  private async requireScene(id: EntityId): Promise<ContentSceneRow> {
    const row = await this.repository.findScene(id);
    if (!row) throw new AppError("not_found", "Scene not found");
    return row;
  }

  private async requireCourse(id: EntityId): Promise<ContentCourseRow> {
    const row = await this.repository.findCourse(id);
    if (!row) throw new AppError("not_found", "Course not found");
    return row;
  }

  private async requireSentence(id: EntityId): Promise<ContentSentenceRow> {
    const row = await this.repository.findSentence(id);
    if (!row) throw new AppError("not_found", "Sentence not found");
    return row;
  }

  private assertSentenceCountRule(min: number, max: number): void {
    if (min <= 0 || max < min) throw new AppError("validation_failed", "Invalid course sentence count rule");
  }

  private async audit(admin: CurrentAdmin, permissionKey: string, action: string, objectType: string, objectId: EntityId, oldValue?: JsonRecord, newValue?: JsonRecord, reason?: string): Promise<void> {
    await this.adminService.audit(admin, permissionKey, action, objectType, EntityIdCodec.stringify(objectId), oldValue, newValue, reason);
  }
}

function issue(objectType: string, objectId: EntityId, objectName: string, severity: ValidationSeverity, message: string, fixTarget: string, extra: JsonRecord = {}): JsonRecord & { severity: ValidationSeverity } {
  return { ...extra, fixTarget, message, objectId: EntityIdCodec.stringify(objectId), objectName, objectType, severity };
}

function dedupeIssues(issues: Array<JsonRecord & { severity: ValidationSeverity }>): Array<JsonRecord & { severity: ValidationSeverity }> {
  const seen = new Set<string>();
  return issues.filter((item) => {
    const key = `${item.objectId}:${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function serialize(row: Record<string, unknown>, idName: string): JsonRecord {
  const output: JsonRecord = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === "id" && typeof value === "bigint") output[idName] = EntityIdCodec.stringify(value);
    else if (typeof value === "bigint") output[key] = EntityIdCodec.stringify(value);
    else if (value instanceof Date) output[key] = value.toISOString();
    else output[key] = value;
  }
  return output;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) throw new AppError("validation_failed", `${field} is required`);
  return value;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function optionalString(value: unknown): string | undefined {
  return value === undefined ? undefined : requiredString(value, "value");
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function nullableString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  return value === null ? null : requiredString(value, "value");
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function optionalNumber(value: unknown): number | undefined {
  return value === undefined ? undefined : numberValue(value, 0);
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}

function optionalStatus(value: unknown): ContentStatus | undefined {
  return value === undefined ? undefined : enumValue(value, contentStatuses, "draft");
}

function recordValue(value: unknown, fallback: JsonRecord): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : fallback;
}

function optionalRecord(value: unknown): JsonRecord | undefined {
  return value === undefined ? undefined : recordValue(value, {});
}

function arrayRecord(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter((item): item is JsonRecord => Boolean(item && typeof item === "object" && !Array.isArray(item))) : [];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function optionalStringArray(value: unknown): string[] | undefined {
  return value === undefined ? undefined : stringArray(value);
}

function pickDefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<T>;
}

function slugValue(value: unknown, fallback: string): string {
  const source = typeof value === "string" && value.length > 0 ? value : fallback;
  const slug = source.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || "content";
}

function importSettingKey(importBatchId: string): string {
  return `${importSettingPrefix}${importBatchId}`;
}

function failedImportRows(rows: JsonRecord[], results: JsonRecord[]): JsonRecord[] {
  const failedRows: JsonRecord[] = [];
  for (const [index, result] of results.entries()) {
    if (result.severity === "error") failedRows.push({ ...(rows[index] ?? {}), errors: result.errors, rowIndex: index });
  }
  return failedRows;
}

function textValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.value === "string") return record.value;
  if (Buffer.isBuffer(record.value)) return record.value.toString("utf8");
  if (typeof record.data === "string") return record.data;
  if (Buffer.isBuffer(record.data)) return record.data.toString("utf8");
  return undefined;
}

function parseImportRows(text: string): JsonRecord[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) return arrayRecord(parsed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return arrayRecord((parsed as JsonRecord).rows);
  }
  return parseCsvRows(trimmed);
}

function importFormat(text: string): string {
  const trimmed = text.trimStart();
  return trimmed.startsWith("[") || trimmed.startsWith("{") ? "json" : "csv";
}

function parseCsvRows(text: string): JsonRecord[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const [headerLine, ...dataLines] = lines;
  const headers = splitCsvLine(headerLine ?? "").map((header) => header.trim());
  return dataLines.map((line) => {
    const cells = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function toCsv(rows: JsonRecord[]): string {
  if (rows.length === 0) return "rowIndex,errors\n";
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function csvCell(value: unknown): string {
  const text = typeof value === "string" ? value : value === undefined || value === null ? "" : JSON.stringify(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
