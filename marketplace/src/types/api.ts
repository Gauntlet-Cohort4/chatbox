/**
 * API response types for the marketplace endpoints.
 */

export interface PluginListItem {
  pluginId: string
  pluginName: string
  description: string
  author: string
  category: string
  contentRating: string
  version: string
  averageRating: number
  totalRatings: number
  screenshotKey: string | null
  bundleSizeBytes: number | null
}

export interface PluginListResponse {
  plugins: PluginListItem[]
  total: number
  page: number
  limit: number
}

export interface PluginDetailResponse {
  pluginId: string
  pluginName: string
  description: string
  version: string
  author: string
  authorEmail: string | null
  category: string
  contentRating: string
  toolDefinitions: string
  userInterfaceConfig: string
  authenticationConfig: string
  contextPrompt: string | null
  capabilities: string
  bundleUrl: string
  bundleVersion: string
  bundleHash: string
  bundleSizeBytes: number | null
  screenshotKey: string | null
  averageRating: number
  totalRatings: number
  submittedAt: number
  ratingDistribution?: Record<number, number>
}

export interface CategoryCount {
  name: string
  count: number
}

export interface CategoriesResponse {
  categories: CategoryCount[]
}

export interface ReviewItem {
  reviewId: string
  teacherName: string
  rating: number
  reviewText: string | null
  createdAt: number
}

export interface ReviewsResponse {
  reviews: ReviewItem[]
  total: number
}

export interface TeacherInfo {
  teacherId: string
  teacherName: string
}

export interface AuthMeResponse {
  teacherId: string
  teacherName: string
}

export interface TeacherPlugin {
  pluginId: string
  pluginName: string
  description: string
  author: string
  category: string
  averageRating: number
  status: string
  addedAt: number
  approvedAt: number | null
  deployedAt: number | null
  revokedAt: number | null
  screenshotKey: string | null
}

export interface TeacherPluginsResponse {
  plugins: TeacherPlugin[]
  joinCode: string
}

export interface AdminStats {
  pendingSubmissions: number
  openReports: number
  totalApprovedPlugins: number
  totalTeachers: number
}

export interface ApiError {
  error: string
  details?: Record<string, string[]>
}
