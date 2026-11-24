const AUTH_TOKEN_KEY = 'bibliosmart_auth_token';

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

export class ApiRequestError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function requestJson<T>(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 12_000,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const token = getAuthToken();

  try {
    const res = await fetch(url, {
      ...options,
      credentials: 'include',
      signal: controller.signal,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });

    const text = await res.text();
    let parsed: Record<string, unknown> = {};
    if (text) {
      try {
        parsed = JSON.parse(text) as Record<string, unknown>;
      } catch {
        parsed = {};
      }
    }

    if (!res.ok) {
      const msg =
        typeof parsed.error === 'string'
          ? parsed.error
          : typeof parsed.mensaje === 'string'
            ? parsed.mensaje
            : typeof parsed.message === 'string'
              ? parsed.message
              : `Error HTTP ${res.status} al consultar ${url}`;
      const code = typeof parsed.code === 'string' ? parsed.code : undefined;
      throw new ApiRequestError(msg, res.status, code);
    }

    return parsed as T;
  } catch (err) {
    if (err instanceof ApiRequestError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiRequestError('Tiempo de espera agotado al conectar con el servidor.', 408);
    }
    throw new ApiRequestError('Error de red al conectar con el servidor.', 503);
  } finally {
    clearTimeout(timer);
  }
}

export const apiClient = {
  get: <T>(url: string, timeoutMs?: number) => requestJson<T>(url, { method: 'GET' }, timeoutMs),
  post: <T>(url: string, body?: unknown, timeoutMs?: number) =>
    requestJson<T>(
      url,
      { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined },
      timeoutMs,
    ),
  put: <T>(url: string, body?: unknown, timeoutMs?: number) =>
    requestJson<T>(
      url,
      { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined },
      timeoutMs,
    ),
  patch: <T>(url: string, body?: unknown, timeoutMs?: number) =>
    requestJson<T>(
      url,
      { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined },
      timeoutMs,
    ),
  del: <T>(url: string, timeoutMs?: number) => requestJson<T>(url, { method: 'DELETE' }, timeoutMs),
};
