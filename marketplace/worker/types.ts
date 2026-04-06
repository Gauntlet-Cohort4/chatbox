/**
 * Worker environment bindings.
 */
export interface Env {
  DB: D1Database
  BUCKET: R2Bucket
  ADMIN_TOKEN: string
  SESSION_SECRET: string
  ENVIRONMENT: string
}

/** Request with attached teacher context from auth middleware */
export interface AuthenticatedRequest extends Request {
  teacherId?: string
  teacherName?: string
}
