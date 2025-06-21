import type { 
  HealthCheck, 
  Profile, 
  Document, 
  DocumentListResponse, 
  DocumentCreate, 
  DocumentUpdate 
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
}

// Create a singleton instance
export const createApiClient = (getAuthToken: () => Promise<string | null>) => {
  const baseURL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000'
  return new ApiClient(baseURL, getAuthToken)
}

export type { ApiClient } 