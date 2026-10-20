export function appBasePath(value = process.env.APP_BASE_PATH || '/HomeMeal') {
  const trimmed = value.trim();
  const segments = trimmed.split('/').filter(Boolean);
  if (!segments.length) return '';
  if (segments.some((segment) => segment === '.' || segment === '..')) throw new Error('APP_BASE_PATH must not contain dot segments.');
  const normalized = `/${segments.join('/')}`;
  if (normalized.includes('?') || normalized.includes('#')) throw new Error('APP_BASE_PATH must contain only a URL path.');
  return normalized;
}

export function appPath(pathname: string, base = appBasePath()) {
  const route = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${base}${route}` || '/';
}
