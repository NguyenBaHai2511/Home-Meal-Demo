const APP_BASE_PATH = import.meta.env.BASE_URL.replace(/\/+$/, '').replace(/^\/$/, '');

export function toAppPath(path: string) {
  const route = path.startsWith('/') ? path : `/${path}`;
  if (APP_BASE_PATH && route === '/') return APP_BASE_PATH;
  if (APP_BASE_PATH && (route === APP_BASE_PATH || route.startsWith(`${APP_BASE_PATH}/`))) return route;
  return `${APP_BASE_PATH}${route}` || '/';
}

export function routePath(pathname: string) {
  if (!APP_BASE_PATH) return pathname || '/';
  if (pathname === APP_BASE_PATH || pathname === `${APP_BASE_PATH}/`) return '/';
  if (pathname.startsWith(`${APP_BASE_PATH}/`)) return pathname.slice(APP_BASE_PATH.length) || '/';
  return pathname || '/';
}

export function currentAppPath() {
  return `${routePath(window.location.pathname)}${window.location.search}${window.location.hash}` || '/';
}

export function apiUrl(query: string) {
  return `${toAppPath('/api')}?${query.replace(/^\?/, '')}`;
}
