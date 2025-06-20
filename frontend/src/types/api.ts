export interface DocumentBase {
  title?: string | null;
  content?: string | null;
}

export interface DocumentCreate extends DocumentBase {
  title: string;
  content: string;
}

export interface DocumentUpdate extends DocumentBase {
  // All fields are optional for updates
}

export interface DocumentResponse extends DocumentBase {
  id: string;
  profile_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentListItem {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentListResponse {
  documents: DocumentListItem[];
  total: number;
}

export interface ProfileResponse {
  id: string;
  display_name: string | null;
  email: string;
  created_at: string;
}

export interface ApiError {
  detail: string;
}

// Auth types
export interface AuthUser {
  id: string;
  email: string;
  user_metadata?: {
    display_name?: string;
  };
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
} 