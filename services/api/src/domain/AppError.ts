export type AppErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation_failed"
  | "upstream_failed";

export class AppError extends Error {
  constructor(
    readonly code: AppErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }

  get statusCode(): number {
    switch (this.code) {
      case "bad_request":
      case "validation_failed":
        return 400;
      case "unauthorized":
        return 401;
      case "forbidden":
        return 403;
      case "not_found":
        return 404;
      case "conflict":
        return 409;
      case "upstream_failed":
        return 502;
    }
  }
}
