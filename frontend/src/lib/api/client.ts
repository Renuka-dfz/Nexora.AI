/**
 * Nexora.AI API Client
 * Manages JWT authorization headers, base URL resolution, and unified error handling.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = sessionStorage.getItem('nexora_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return {} as T;
  }

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    let errorMessage = 'An error occurred';
    if (typeof data === 'string') {
      errorMessage = data;
    } else if (data?.detail) {
      errorMessage = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
    } else if (data?.message) {
      errorMessage = data.message;
    }

    if (response.status === 401) {
      sessionStorage.removeItem('nexora_token');
      sessionStorage.removeItem('nexora_user');
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }

    throw new ApiError(response.status, errorMessage, data);
  }

  return data as T;
}
