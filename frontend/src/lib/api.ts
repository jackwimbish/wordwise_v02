import type { 
  HealthCheck, 
  Profile, 
  Document, 
  DocumentListResponse, 
  DocumentCreate, 
  DocumentUpdate,
  ParagraphAnalysisRequest,
  SuggestionAnalysisResponse,
  DismissSuggestionRequest,
  DismissSuggestionResponse,
  ClearDismissedSuggestionsResponse,
  LengthRewriteRequest,
  LengthRewriteResponse,
  RetryRewriteRequest,
  RetryRewriteResponse
} from '@/types'

class ApiClient {
  private baseURL: string
  private getAuthToken: () => Promise<string | null>

  constructor(baseURL: string, getAuthToken: () => Promise<string | null>) {
    this.baseURL = baseURL
    this.getAuthToken = getAuthToken
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    }

    // Add auth token if available
    const token = await this.getAuthToken()
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const config: RequestInit = {
      ...options,
      headers,
      // Add timeout to prevent hanging requests
      signal: options.signal || AbortSignal.timeout(30000), // 30 second timeout
    }

    try {
      const response = await fetch(url, config)
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      // Handle responses with no content (like 204 No Content)
      if (response.status === 204 || response.headers.get('content-length') === '0') {
        return undefined as T
      }

      // Check if response has content to parse
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        return await response.json()
      } else {
        // For non-JSON responses, return the text
        const text = await response.text()
        return (text || undefined) as T
      }
    } catch (error) {
      // Don't log errors for aborted requests (these are expected during tab switches)
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error
      }
      console.error(`API request failed: ${endpoint}`, error)
      throw error
    }
  }

  // Health Check
  async healthCheck(): Promise<HealthCheck> {
    return this.request<HealthCheck>('/')
  }

  // Profile
  async getProfile(): Promise<Profile> {
    return this.request<Profile>('/api/v1/profile/me')
  }

  // Documents
  async getDocuments(): Promise<DocumentListResponse> {
    return this.request<DocumentListResponse>('/api/v1/documents/')
  }

  async getDocument(id: string): Promise<Document> {
    return this.request<Document>(`/api/v1/documents/${id}`)
  }

  async createDocument(data: DocumentCreate): Promise<Document> {
    return this.request<Document>('/api/v1/documents/', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateDocument(id: string, data: DocumentUpdate): Promise<Document> {
    return this.request<Document>(`/api/v1/documents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteDocument(id: string): Promise<void> {
    return this.request<void>(`/api/v1/documents/${id}`, {
      method: 'DELETE',
    })
  }

  // Document Import
  async importDocument(file: File): Promise<Document> {
    const formData = new FormData()
    formData.append('file', file)

    const token = await this.getAuthToken()
    const headers: Record<string, string> = {}
    
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const response = await fetch(`${this.baseURL}/api/v1/import/file`, {
      method: 'POST',
      headers,
      body: formData,
      signal: AbortSignal.timeout(60000), // 60 second timeout for file uploads
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return await response.json()
  }

  // Document Export
  async exportDocument(title: string, content: string, format: 'txt' | 'docx' | 'pdf'): Promise<{ blob: Blob; filename: string }> {
    const token = await this.getAuthToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const response = await fetch(`${this.baseURL}/api/v1/export/file`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title,
        content,
        format,
      }),
      signal: AbortSignal.timeout(60000), // 60 second timeout for file generation
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    // Return blob and filename for download
    const blob = await response.blob()
    const contentDisposition = response.headers.get('content-disposition')
    const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || `document.${format}`
    
    return { blob, filename }
  }

  // Suggestions
  async analyzeParagraphs(data: ParagraphAnalysisRequest, signal?: AbortSignal): Promise<SuggestionAnalysisResponse> {
    return this.request<SuggestionAnalysisResponse>('/api/v1/suggestions/analyze', {
      method: 'POST',
      body: JSON.stringify(data),
      signal,
    })
  }

  async dismissSuggestion(data: DismissSuggestionRequest): Promise<DismissSuggestionResponse> {
    return this.request<DismissSuggestionResponse>('/api/v1/suggestions/dismiss', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async clearDismissedSuggestions(documentId: string): Promise<ClearDismissedSuggestionsResponse> {
    return this.request<ClearDismissedSuggestionsResponse>(`/api/v1/suggestions/dismissed/${documentId}`, {
      method: 'DELETE',
    })
  }

  // Length Rewriter
  async rewriteForLength(data: LengthRewriteRequest, signal?: AbortSignal): Promise<LengthRewriteResponse> {
    return this.request<LengthRewriteResponse>('/api/v1/rewrite/length', {
      method: 'POST',
      body: JSON.stringify(data),
      signal,
    })
  }

  async retryRewrite(data: RetryRewriteRequest, signal?: AbortSignal): Promise<RetryRewriteResponse> {
    return this.request<RetryRewriteResponse>('/api/v1/rewrite/retry', {
      method: 'POST',
      body: JSON.stringify(data),
      signal,
    })
  }
}

// Create a singleton instance
export const createApiClient = (getAuthToken: () => Promise<string | null>) => {
  const baseURL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000'
  return new ApiClient(baseURL, getAuthToken)
}

export type { ApiClient } 