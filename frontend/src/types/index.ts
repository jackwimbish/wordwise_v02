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

// Suggestion Types
export interface ParagraphToAnalyze {
  paragraph_id: string
  text_content: string
  base_offset: number
}

export interface ParagraphAnalysisRequest {
  document_id: string
  paragraphs: ParagraphToAnalyze[]
}

export interface SuggestionResponse {
  suggestion_id: string
  rule_id: string
  category: 'spelling' | 'grammar' | 'style'
  original_text: string
  suggestion_text: string
  message: string
  global_start: number
  global_end: number
  dismissal_identifier: string
}

export interface SuggestionAnalysisResponse {
  suggestions: SuggestionResponse[]
  total_paragraphs_processed: number
  errors: string[]
}

export interface DismissSuggestionRequest {
  document_id: string
  original_text: string
  rule_id: string
}

export interface DismissSuggestionResponse {
  success: boolean
  dismissal_identifier: string
}

export interface ClearDismissedSuggestionsResponse {
  success: boolean
  cleared_count: number
  message: string
}

// Auth Types
export interface AuthUser {
  id: string
  email?: string
  user_metadata?: {
    display_name?: string
  }
}

// Length Rewriter Types
export interface LengthRewriteRequest {
  document_id: string
  full_text: string
  target_length: number
  unit: 'words' | 'characters'
  mode?: 'shorten' | 'lengthen' // Optional - backend will determine automatically
}

export interface ParagraphRewrite {
  paragraph_id: number
  original_text: string
  rewritten_text: string
  original_length: number
  rewritten_length: number
}

export interface LengthRewriteResponse {
  document_id: string
  original_length: number
  target_length: number
  unit: string
  mode: string
  paragraph_rewrites: ParagraphRewrite[]
  total_paragraphs: number
}

export interface RetryRewriteRequest {
  original_paragraph: string
  previous_suggestion: string
  target_length: number
  unit: 'words' | 'characters'
  mode?: 'shorten' | 'lengthen' // Optional - backend will determine automatically
}

export interface RetryRewriteResponse {
  rewritten_text: string
  original_length: number
  rewritten_length: number
}

// API Client Types
export interface ApiClientConfig {
  baseURL: string
  getAuthToken: () => Promise<string | null>
} 