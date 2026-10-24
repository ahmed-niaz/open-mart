import { toast } from 'sonner';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | null | undefined>;
  skipErrorToast?: boolean;
}

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

export async function apiClient<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { params, skipErrorToast, headers, ...customConfig } = options;

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  let url = endpoint.startsWith('http')
    ? endpoint
    : typeof window === 'undefined'
      ? `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`
      : endpoint;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        searchParams.append(key, String(value));
      }
    });
    const qs = searchParams.toString();
    if (qs) {
      url += (url.includes('?') ? '&' : '?') + qs;
    }
  }

  const defaultHeaders: Record<string, string> = {};
  if (
    typeof FormData !== 'undefined' &&
    !(customConfig.body instanceof FormData)
  ) {
    defaultHeaders['Content-Type'] = 'application/json';
  } else if (typeof FormData === 'undefined') {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  // Check if there is an admin access token stored in localStorage
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('admin_access_token');
    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  const config: RequestInit = {
    method: customConfig.method || 'GET',
    headers: {
      ...defaultHeaders,
      ...headers,
    },
    credentials: 'include',
    ...customConfig,
  };

  try {
    const response = await fetch(url, config);

    // Handle 401 Unauthorized token refresh
    if (
      response.status === 401 &&
      !url.includes('/auth/login') &&
      !url.includes('/auth/refresh')
    ) {
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refreshRes = await fetch('/api/admin/auth/refresh', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          });

          if (refreshRes.ok) {
            const data = await refreshRes.json();
            if (data?.accessToken && typeof window !== 'undefined') {
              localStorage.setItem('admin_access_token', data.accessToken);
            }
            processQueue(null);
            isRefreshing = false;
            return apiClient<T>(endpoint, options);
          } else {
            throw new Error('Refresh failed');
          }
        } catch (refreshErr) {
          processQueue(refreshErr as Error);
          isRefreshing = false;
          if (typeof window !== 'undefined') {
            localStorage.removeItem('admin_access_token');
            if (!window.location.pathname.startsWith('/admin/login')) {
              window.location.replace('/admin/login');
            }
          }
          throw new ApiError('Session expired. Please log in again.', 401);
        }
      } else {
        // Wait for refreshing to complete
        return new Promise<T>((resolve, reject) => {
          failedQueue.push({
            resolve: () => resolve(apiClient<T>(endpoint, options)),
            reject,
          });
        });
      }
    }

    if (!response.ok) {
      let errorMessage = 'An unexpected error occurred';
      let errorCode: string | undefined;
      let errorDetails: unknown;

      try {
        const errorJson = await response.json();
        errorMessage =
          errorJson.message ||
          (Array.isArray(errorJson.messages)
            ? errorJson.messages.join(', ')
            : null) ||
          errorMessage;
        errorCode = errorJson.code || errorJson.error;
        errorDetails = errorJson.details || errorJson;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }

      if (!skipErrorToast && typeof window !== 'undefined') {
        toast.error(errorMessage);
      }

      throw new ApiError(
        errorMessage,
        response.status,
        errorCode,
        errorDetails,
      );
    }

    // If 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'Network error';
    if (!skipErrorToast && typeof window !== 'undefined') {
      toast.error(message);
    }
    throw new ApiError(message, 500);
  }
}
