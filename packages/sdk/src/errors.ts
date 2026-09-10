export class DeployxaError extends Error { constructor(message: string, readonly status: number, readonly code?: string, readonly requestId?: string, readonly details?: unknown) { super(message); this.name = new.target.name; } }
export class AuthenticationError extends DeployxaError {}
export class AuthorizationError extends DeployxaError {}
export class ValidationError extends DeployxaError {}
export class RateLimitError extends DeployxaError {}
export class DeploymentError extends DeployxaError {}
export class RuntimeError extends DeployxaError {}
export class ProviderError extends DeployxaError {}
export class NetworkError extends DeployxaError { constructor(message: string, details?: unknown) { super(message, 0, 'NETWORK_ERROR', undefined, details); } }
export class TimeoutError extends DeployxaError { constructor(message = 'Request timed out.') { super(message, 408, 'TIMEOUT'); } }
export class CompatibilityError extends DeployxaError {}

export function sdkError(status: number, message: string, code?: string, requestId?: string, details?: unknown) {
  const ErrorType = status === 401 ? AuthenticationError : status === 403 ? AuthorizationError : status === 422 || status === 400 ? ValidationError : status === 429 ? RateLimitError : DeployxaError;
  return new ErrorType(message, status, code, requestId, details);
}
