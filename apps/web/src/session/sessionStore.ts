import type { UserSession } from "../types";

const storageKey = "learning-activation-user-session";

export function loadSession(): UserSession | null {
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as UserSession;
    return parsed.sessionId ? parsed : null;
  } catch {
    clearSession();
    return null;
  }
}

export function saveSession(session: UserSession): void {
  window.localStorage.setItem(storageKey, JSON.stringify(session));
}

export function clearSession(): void {
  window.localStorage.removeItem(storageKey);
}
