/**
 * Typed marketplace API endpoint wrappers.
 *
 * All functions return the response body (already JSON-parsed) or throw
 * `ApiClientError` on non-2xx. They accept plain primitives — the caller
 * does not need to build URLs or handle form data.
 */
import { apiClient } from './client'
import type {
  AuthMeResponse,
  CategoriesResponse,
  PluginDetailResponse,
  PluginListResponse,
  ReviewsResponse,
  TeacherPluginsResponse,
} from '../types/api'

// ─── Marketplace (public) ────────────────────────────────────────────────────

export interface ListPluginsOptions {
  category?: string
  search?: string
  sort?: 'rating' | 'popular' | 'newest' | 'name'
  page?: number
  limit?: number
}

export function listPlugins(opts: ListPluginsOptions = {}): Promise<PluginListResponse> {
  const params = new URLSearchParams()
  if (opts.category && opts.category !== 'All') params.set('category', opts.category)
  if (opts.search) params.set('search', opts.search)
  if (opts.sort) params.set('sort', opts.sort)
  if (opts.page) params.set('page', String(opts.page))
  if (opts.limit) params.set('limit', String(opts.limit))
  const qs = params.toString()
  return apiClient.get<PluginListResponse>(`/marketplace/plugins${qs ? `?${qs}` : ''}`)
}

export function getPluginDetail(pluginId: string): Promise<PluginDetailResponse> {
  return apiClient.get<PluginDetailResponse>(`/marketplace/plugins/${encodeURIComponent(pluginId)}`)
}

export function listCategories(): Promise<CategoriesResponse> {
  return apiClient.get<CategoriesResponse>('/marketplace/categories')
}

export function getPluginImageUrl(pluginId: string): string {
  return `/marketplace/plugins/${encodeURIComponent(pluginId)}/image`
}

// ─── Reviews ────────────────────────────────────────────────────────────────

export function listReviews(pluginId: string, page = 1, limit = 20): Promise<ReviewsResponse> {
  return apiClient.get<ReviewsResponse>(
    `/marketplace/plugins/${encodeURIComponent(pluginId)}/reviews?page=${page}&limit=${limit}`
  )
}

export function createReview(
  pluginId: string,
  data: { rating: number; reviewText?: string }
): Promise<{ reviewId: string; status: string }> {
  return apiClient.post(`/marketplace/plugins/${encodeURIComponent(pluginId)}/reviews`, data)
}

export function updateReview(
  pluginId: string,
  data: { rating: number; reviewText?: string }
): Promise<{ reviewId: string; status: string }> {
  return apiClient.put(`/marketplace/plugins/${encodeURIComponent(pluginId)}/reviews`, data)
}

export function createReport(
  pluginId: string,
  data: { reportReason: string; reportDetails?: string }
): Promise<{ reportId: string; status: string }> {
  return apiClient.post(`/marketplace/plugins/${encodeURIComponent(pluginId)}/reports`, data)
}

// ─── Auth ───────────────────────────────────────────────────────────────────

export function authMe(): Promise<AuthMeResponse> {
  return apiClient.get<AuthMeResponse>('/auth/me')
}

export function authExchange(code: string): Promise<{ status: string; expiresAt: number }> {
  return apiClient.post('/auth/exchange', { code })
}

export function authLogout(): Promise<{ status: string }> {
  return apiClient.post('/auth/logout')
}

// ─── Teacher classroom ───────────────────────────────────────────────────────

export function listTeacherPlugins(teacherId: string): Promise<TeacherPluginsResponse> {
  return apiClient.get<TeacherPluginsResponse>(
    `/teachers/${encodeURIComponent(teacherId)}/plugins`
  )
}

export function addTeacherPlugin(
  teacherId: string,
  pluginId: string
): Promise<{ status: string }> {
  return apiClient.post(
    `/teachers/${encodeURIComponent(teacherId)}/plugins/${encodeURIComponent(pluginId)}`
  )
}

export function approveTeacherPlugin(teacherId: string, pluginId: string): Promise<{ status: string }> {
  return apiClient.put(
    `/teachers/${encodeURIComponent(teacherId)}/plugins/${encodeURIComponent(pluginId)}/approve`
  )
}

export function deployTeacherPlugin(teacherId: string, pluginId: string): Promise<{ status: string }> {
  return apiClient.put(
    `/teachers/${encodeURIComponent(teacherId)}/plugins/${encodeURIComponent(pluginId)}/deploy`
  )
}

export function revokeTeacherPlugin(teacherId: string, pluginId: string): Promise<{ status: string }> {
  return apiClient.put(
    `/teachers/${encodeURIComponent(teacherId)}/plugins/${encodeURIComponent(pluginId)}/revoke`
  )
}

export function removeTeacherPlugin(teacherId: string, pluginId: string): Promise<{ status: string }> {
  return apiClient.delete(
    `/teachers/${encodeURIComponent(teacherId)}/plugins/${encodeURIComponent(pluginId)}`
  )
}

// ─── Submissions ────────────────────────────────────────────────────────────

export function submitPlugin(formData: FormData): Promise<{ pluginId: string; status: string }> {
  return apiClient.postForm('/marketplace/plugins', formData)
}

// ─── Admin ──────────────────────────────────────────────────────────────────

export function adminListSubmissions(): Promise<{ submissions: PluginDetailResponse[] }> {
  return apiClient.get('/admin/submissions')
}

export function adminApproveSubmission(pluginId: string): Promise<{ status: string }> {
  return apiClient.put(`/admin/submissions/${encodeURIComponent(pluginId)}/approve`)
}

export function adminRejectSubmission(
  pluginId: string,
  rejectionReason: string
): Promise<{ status: string }> {
  return apiClient.put(`/admin/submissions/${encodeURIComponent(pluginId)}/reject`, { rejectionReason })
}

export function adminListReports(status?: 'open' | 'resolved'): Promise<{ reports: unknown[] }> {
  const qs = status ? `?status=${status}` : ''
  return apiClient.get(`/admin/reports${qs}`)
}

export function adminResolveReport(
  reportId: string,
  resolution: 'resolved' | 'dismissed',
  notes?: string
): Promise<{ status: string }> {
  return apiClient.put(`/admin/reports/${encodeURIComponent(reportId)}`, { resolution, notes })
}
