const SCHEMA_ERROR_CODES = new Set(['42P01', '42703', '42704', '3F000']);

export function isDatabaseSchemaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && SCHEMA_ERROR_CODES.has(code);
}
