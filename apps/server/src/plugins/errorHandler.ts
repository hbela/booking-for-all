import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { AppError } from "../errors/AppError";
import { captureException } from "../instrument";
import { ZodError } from "zod";

export function errorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request: FastifyRequest, reply: FastifyReply) => {
    // Zod validation error
    if (error instanceof ZodError) {
      return reply.status(422).send({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
        issues: error.issues,
      });
    }

    // Known business error thrown by AppError
    if ((error as any).isAppError) {
      const appError = error as AppError;
      return reply.status(appError.statusCode).send({
        success: false,
        code: appError.code,
        message: appError.message,
      });
    }

    // Unexpected error — log to Sentry & server logs
    request.log.error(error);
    captureException(error instanceof Error ? error : new Error(String(error)));

    return reply.status(500).send({
      success: false,
      code: "INTERNAL_ERROR",
      message: "Something went wrong",
    });
  });
}

