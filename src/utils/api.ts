const TOKEN_KEY = 'salontrack_auth_token';
const ACTIVE_BUSINESS_KEY = 'salontrack_active_business';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getStoredActiveBusinessId(): string | null {
  return localStorage.getItem(ACTIVE_BUSINESS_KEY);
}

export function setStoredActiveBusinessId(id: string | null) {
  if (id) localStorage.setItem(ACTIVE_BUSINESS_KEY, id);
  else localStorage.removeItem(ACTIVE_BUSINESS_KEY);
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const activeBusinessId = getStoredActiveBusinessId();
  if (activeBusinessId) headers['X-Business-Id'] = activeBusinessId;

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || `Error ${response.status}: ${response.statusText}`;
    throw new Error(errorMsg);
  }

  return data as T;
}
