import type { AdminSession } from "../types";

const storageKey = "learning-activation-admin-session";

export function loadAdminSession(): AdminSession | null {
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as AdminSession;
    if (!parsed.adminSessionId) {
      clearAdminSession();
      return null;
    }
    return parsed;
  } catch {
    clearAdminSession();
    return null;
  }
}

export function saveAdminSession(session: AdminSession): void {
  window.localStorage.setItem(storageKey, JSON.stringify(session));
}

export function clearAdminSession(): void {
  window.localStorage.removeItem(storageKey);
}
