const LOCAL_ORB_BACKEND_BASE_URL = 'http://localhost:8000';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

export function getOrbBackendBaseUrl(): string | null {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_ORB_BACKEND_URL?.trim();
  if (configuredBaseUrl) {
    return trimTrailingSlash(configuredBaseUrl);
  }

  if (typeof window !== 'undefined' && isLocalHostname(window.location.hostname)) {
    return LOCAL_ORB_BACKEND_BASE_URL;
  }

  return null;
}

export function getOrbBackendUrl(path: string): string | null {
  const baseUrl = getOrbBackendBaseUrl();
  if (!baseUrl) {
    return null;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

export function getOrbBackendUnavailableMessage(): string {
  return 'ORB backend is not configured for this environment. Set NEXT_PUBLIC_ORB_BACKEND_URL for deployed clients.';
}
