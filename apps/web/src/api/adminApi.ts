import type {
  AdminContentUnitResponse,
  CreateContentUnitInput,
  ImportBbcResponse,
  ImportLearningUnitInput,
  ImportLearningUnitResponse,
} from "../types";
import { requestJson } from "./client";

export function createContentUnit(input: CreateContentUnitInput): Promise<AdminContentUnitResponse> {
  return requestJson<AdminContentUnitResponse>("/admin/content-units", {
    method: "POST",
    requireSession: true,
    body: input,
  });
}

export function importBbcContentUnit(sourceUrl: string): Promise<ImportBbcResponse> {
  return requestJson<ImportBbcResponse>("/admin/content-units/import-bbc", {
    method: "POST",
    requireSession: true,
    body: { sourceUrl },
  });
}

export function importLearningUnit(input: ImportLearningUnitInput): Promise<ImportLearningUnitResponse> {
  return requestJson<ImportLearningUnitResponse>("/admin/content-units/import-learning-unit", {
    method: "POST",
    requireSession: true,
    body: input,
  });
}

export function publishContentUnit(unitId: string): Promise<unknown> {
  return requestJson(`/admin/content-units/${unitId}/publish`, {
    method: "POST",
    requireSession: true,
  });
}

export function autoSyncContentUnit(unitId: string): Promise<{ unitId: string }> {
  return requestJson<{ unitId: string }>(`/admin/content-units/${unitId}/auto-sync`, {
    method: "POST",
    requireSession: true,
  });
}
