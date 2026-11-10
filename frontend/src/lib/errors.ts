import { ApiError } from '../api/client';

export type ErrorTranslator = (
  keyPath: string,
  params?: Record<string, string | number>,
) => string;

export function errorMessage(
  error: unknown,
  fallback = 'Something went wrong.',
  t?: ErrorTranslator,
): string {
  if (error instanceof ApiError) {
    if (error.message) return error.message;
    if (t && error.fallbackKey) {
      return t(error.fallbackKey, { status: error.status });
    }
    return fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return fallback;
}

export function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
