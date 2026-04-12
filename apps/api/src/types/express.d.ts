/* Augment Express Request to include the user property set by TSOA auth middleware */
declare namespace Express {
  interface Request {
    user?: {
      id: string
      email: string
      name: string
    }
  }
}
