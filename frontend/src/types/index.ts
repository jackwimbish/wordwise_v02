// API Response Types
export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
  message?: string
}

// Health Check
export interface HealthCheck {
  status: string
  message: string
}

// User Profile
export interface Profile {
  id: string
  display_name: string | null
  email: string
  created_at: string
}

// Document Types
export interface Document {
  id: string
  profile_id: string
  title: string
  content: string
  created_at: string
  updated_at: string
}

export interface DocumentListItem {
  id: string
  title: string
  content_preview?: string
  created_at: string
  updated_at: string
}

export interface DocumentListResponse {
  documents: DocumentListItem[]
  total: number
}

export interface DocumentCreate {
  title: string
  content: string
}

export interface DocumentUpdate {
  title?: string
  content?: string
}

// Auth Types
export interface AuthUser {
  id: string
  email?: string
  user_metadata?: {
    display_name?: string
  }
}

// API Client Types
export interface ApiClientConfig {
  baseURL: string
  getAuthToken: () => Promise<string | null>
} 