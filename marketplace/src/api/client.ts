/**
 * Marketplace API client.
 *
 * All requests include `credentials: 'include'` so that HttpOnly session
 * cookies are sent automatically. On 401, we clear local auth state.
 */

const API_BASE = import.meta.env.VITE_API_URL ?? ''

class ApiClient {
  private adminToken: string | null = null

  setAdminToken(token: string | null) {
    this.adminToken = token
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers)

    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json')
    }

    if (this.adminToken && path.startsWith('/admin')) {
      headers.set('Authorization', `Bearer ${this.adminToken}`)
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    })

    if (response.status === 401) {
      // Dispatch custom event so auth hook can clear state
      window.dispatchEvent(new CustomEvent('marketplace:auth-expired'))
    }

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({ error: response.statusText }))) as {
        error?: string
        details?: Record<string, string[]>
      }
      throw new ApiClientError(response.status, errorBody.error ?? 'Request failed', errorBody.details)
    }

    if (response.status === 204) {
      return undefined as T
    }

    return response.json()
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path)
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    })
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PUT',
      body: body != null ? JSON.stringify(body) : undefined,
    })
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' })
  }

  postForm<T>(path: string, formData: FormData): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: formData,
    })
  }
}

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, string[]>
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

export const apiClient = new ApiClient()
