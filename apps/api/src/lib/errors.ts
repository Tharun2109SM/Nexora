import type { NextFunction, Request, Response } from 'express'
import { z, ZodError } from 'zod'

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function notFoundHandler(request: Request, _response: Response, next: NextFunction) {
  next(new AppError(404, 'NOT_FOUND', `No API route matches ${request.method} ${request.path}.`))
}

export function errorHandler(
  error: unknown,
  request: Request,
  response: Response,
  next: NextFunction,
) {
  void next
  const appError =
    error instanceof AppError
      ? error
      : error instanceof ZodError
        ? new AppError(400, 'VALIDATION_ERROR', 'The request is invalid.', z.treeifyError(error))
        : new AppError(500, 'INTERNAL_ERROR', 'An unexpected server error occurred.')

  if (appError.status >= 500)
    request.log.error({ err: error, requestId: request.requestId }, 'Request failed')
  else request.log.warn({ code: appError.code, requestId: request.requestId }, appError.message)

  response.status(appError.status).json({
    error: {
      code: appError.code,
      ...(appError.details === undefined ? {} : { details: appError.details }),
      message: appError.message,
      requestId: request.requestId,
    },
  })
}
