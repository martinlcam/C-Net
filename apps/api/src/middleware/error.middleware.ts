import type { NextFunction, Request, Response } from "express"
import { ValidateError } from "tsoa"

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
