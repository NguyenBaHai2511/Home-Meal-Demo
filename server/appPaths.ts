export function appBasePath(value = process.env.APP_BASE_PATH || '/') {
  let configuredPath = value.trim();
  if (/^https?:\/\//i.test(configuredPath)) {
    const url = new URL(configuredPath);
    if (url.search || url.hash) throw new Error('APP_BASE_PATH must not contain a query string or fragment.');
    configuredPath = url.pathname;
  }
  if (configuredPath.includes('?') || configuredPath.includes('#')) throw new Error('APP_BASE_PATH must contain only a URL path.');
  const segments = configuredPath.split('/').filter(Boolean);
  if (!segments.length) return '';
  if (segments.some((segment) => segment === '.' || segment === '..')) throw new Error('APP_BASE_PATH must not contain dot segments.');
  const normalized = `/${segments.join('/')}`;
  return normalized;
}

export function appPath(pathname: string, base = appBasePath()) {
  const route = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${base}${route}` || '/';
}
