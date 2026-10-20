// From @tsoa/runtime, not "tsoa": the generated routes throw the runtime's class, and the
// "tsoa" re-export resolves to a different copy, so instanceof against it never matched.
import { ValidateError } from "@tsoa/runtime"
import type { NextFunction, Request, Response } from "express"

/**
 * An error that carries its HTTP status. Controllers throw this for client errors;
 * `this.setStatus(4xx)` followed by a plain `throw` never reaches the client as 4xx,
 * because tsoa hands the thrown error to this handler, which has to pick the status.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
    this.name = "HttpError"
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ValidateError) {
    res.status(422).json({
      message: "Validation failed",
      details: err.fields,
    })
    return
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message })
    return
  }

  if (err instanceof Error && err.name === "ForbiddenError") {
    res.status(403).json({ message: err.message })
    return
  }

  if (err instanceof Error) {
    const status = err.message.includes("token") || err.message.includes("Unauthorized") ? 401 : 500
    res.status(status).json({
      message: err.message,
    })
    return
  }

  res.status(500).json({
    message: "Internal server error",
  })
}
