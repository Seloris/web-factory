import { HttpErrorResponse } from '@angular/common/http';

// The body the API sends on every error (`application/problem+json`, RFC 9457); `errors` on a 400, per field.
export interface ProblemDetails {
  status: number;
  title?: string;
  detail?: string;
  code?: string;
  errors?: Record<string, string[]>;
}

export function problemOf(error: unknown): ProblemDetails | null {
  return error instanceof HttpErrorResponse && typeof error.error === 'object' && error.error !== null
    ? (error.error as ProblemDetails)
    : null;
}
