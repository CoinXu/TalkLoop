import { loadAdminSession } from "../session/adminSessionStore";
import { loadSession } from "../session/sessionStore";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:3000";

export type ApiErrorCode = "authRequired" | "requestFailed" | "serverMessage";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: ApiErrorCode,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  requireAdmin?: boolean;
  requireSession?: boolean;
};

type FormRequestOptions = Omit<RequestInit, "body"> & {
  body: FormData;
  requireAdmin?: boolean;
  requireSession?: boolean;
};

export async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return request<T>(path, options);
}

export async function requestFormData<T>(path: string, options: FormRequestOptions): Promise<T> {
  return request<T>(path, options);
}

async function request<T>(path: string, options: RequestOptions | FormRequestOptions): Promise<T> {
  const userSession = loadSession();
  const adminSession = loadAdminSession();
  const { body, requireAdmin, requireSession, ...requestOptions } = options;

  if (requireSession && !userSession) {
    throw new ApiError("authRequired", 401, "authRequired");
  }
  if (requireAdmin && !adminSession) {
    throw new ApiError("authRequired", 401, "authRequired");
  }

  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (body !== undefined && !(body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (userSession) {
    headers.set("x-session-id", userSession.sessionId);
  }
  if (adminSession) {
    headers.set("x-admin-session-id", adminSession.adminSessionId);
  }

  const init: RequestInit = {
    ...requestOptions,
    headers,
  };
  if (body !== undefined) {
    init.body = body instanceof FormData ? body : JSON.stringify(body);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, init);
  const payload = await readPayload(response);
  if (!response.ok) {
    const message = getErrorMessage(payload) ?? "requestFailed";
    throw new ApiError(message, response.status, getErrorMessage(payload) ? "serverMessage" : "requestFailed", payload);
  }

  return payload as T;
}

async function readPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getErrorMessage(payload: unknown): string | null {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    return typeof message === "string" ? message : null;
  }
  return null;
}
