import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { AppError } from "../domain/AppError.js";

export class HttpErrorHandler {
  register(app: FastifyInstance): void {
    app.setErrorHandler((error, request, reply) => {
      if (error instanceof AppError) {
        request.log.warn({ code: error.code, details: error.details }, error.message);
        void reply.status(error.statusCode).send({
          error: error.code,
          message: error.message,
          details: error.details,
        });
        return;
      }

      if (error instanceof ZodError) {
        void reply.status(400).send({
          error: "validation_failed",
          message: "Invalid request payload",
          details: error.flatten(),
        });
        return;
      }

      request.log.error({ error }, "unhandled request error");
      void reply.status(500).send({
        error: "internal_server_error",
        message: "Internal server error",
      });
    });
  }
}
