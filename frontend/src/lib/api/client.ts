import { createClient } from '@/lib/supabase/client';
import { 
  DocumentCreate, 
  DocumentUpdate, 
  DocumentResponse, 
  DocumentListResponse,
  ProfileResponse,
  ApiError 
} from '@/types/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

class ApiClient {
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData: ApiError = await response.json().catch(() => ({ 
        detail: `HTTP ${response.status}: ${response.statusText}` 
      }));
      throw new Error(errorData.detail);
    }

    // Handle 204 No Content responses
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  // Document API methods
  async getDocuments(): Promise<DocumentListResponse> {
    return this.request<DocumentListResponse>('/api/v1/documents/');
  }

  async getDocument(id: string): Promise<DocumentResponse> {
    return this.request<DocumentResponse>(`/api/v1/documents/${id}`);
  }

  async createDocument(data: DocumentCreate): Promise<DocumentResponse> {
    return this.request<DocumentResponse>('/api/v1/documents/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDocument(id: string, data: DocumentUpdate): Promise<DocumentResponse> {
    return this.request<DocumentResponse>(`/api/v1/documents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteDocument(id: string): Promise<void> {
    await this.request<void>(`/api/v1/documents/${id}`, {
      method: 'DELETE',
    });
  }

  // Profile API methods
  async getProfile(): Promise<ProfileResponse> {
    return this.request<ProfileResponse>('/api/v1/profile/me');
  }
}

export const apiClient = new ApiClient(); 