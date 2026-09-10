export const ErrorCode = {
  Unauthorized: 'UNAUTHORIZED',
  Forbidden: 'FORBIDDEN',
  NotFound: 'NOT_FOUND',
  ValidationFailed: 'VALIDATION_FAILED',
  Conflict: 'CONFLICT',
  RateLimited: 'RATE_LIMITED',
  RequestTimeout: 'REQUEST_TIMEOUT',
  ServiceUnavailable: 'SERVICE_UNAVAILABLE',
  Internal: 'INTERNAL_ERROR',
  DeploymentFailed: 'DEPLOYMENT_FAILED',
  QuotaExceeded: 'QUOTA_EXCEEDED',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface FieldViolation {
  field: string;
  message: string;
  code?: string;
}

export interface ApiError {
  code: ErrorCode | (string & {});
  message: string;
  requestId?: string;
  details?: unknown;
  violations?: FieldViolation[];
}

export interface ApiErrorResponse {
  error: ApiError;
}
