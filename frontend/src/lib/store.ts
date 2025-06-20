import { create } from 'zustand'
import { createClient } from './supabase'
import { createApiClient, type ApiClient } from './api'
import type { AuthUser, Profile, DocumentListItem, Document } from '@/types'

interface AppState {
  // Auth state
  user: AuthUser | null
  profile: Profile | null
  isLoading: boolean
  
  // Documents state
  documents: DocumentListItem[]
  documentsLoading: boolean
  
  // Current document editing state
  currentDocument: Document | null
  currentDocumentLoading: boolean
  currentDocumentSaving: boolean
  hasUnsavedChanges: boolean
  
  // API client
  apiClient: ApiClient
  
  // Actions
  setUser: (user: AuthUser | null) => void
  setProfile: (profile: Profile | null) => void
  setLoading: (loading: boolean) => void
  setDocuments: (documents: DocumentListItem[]) => void
  setDocumentsLoading: (loading: boolean) => void
  loadDocuments: () => Promise<void>
  
  // Document editing actions
  setCurrentDocument: (document: Document | null) => void
  setCurrentDocumentLoading: (loading: boolean) => void
  setCurrentDocumentSaving: (saving: boolean) => void
  setHasUnsavedChanges: (hasChanges: boolean) => void
  loadCurrentDocument: (id: string) => Promise<void>
  saveCurrentDocument: () => Promise<void>
  updateCurrentDocumentContent: (content: string) => void
  updateCurrentDocumentTitle: (title: string) => void
  
  signOut: () => Promise<void>
  
  // Initialize auth
  initializeAuth: () => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => {
  const supabase = createClient()
  
  // Create API client with auth token getter
  const apiClient = createApiClient(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  })

  return {
    user: null,
    profile: null,
    isLoading: true,
    documents: [],
    documentsLoading: false,
    currentDocument: null,
    currentDocumentLoading: false,
    currentDocumentSaving: false,
    hasUnsavedChanges: false,
    apiClient,
    
    setUser: (user) => set({ user }),
    setProfile: (profile) => set({ profile }),
    setLoading: (isLoading) => set({ isLoading }),
    setDocuments: (documents) => set({ documents }),
    setDocumentsLoading: (documentsLoading) => set({ documentsLoading }),
    
    loadDocuments: async () => {
      try {
        set({ documentsLoading: true })
        const response = await apiClient.getDocuments()
        set({ documents: response.documents })
      } catch (error) {
        console.error('Failed to load documents:', error)
        set({ documents: [] })
      } finally {
        set({ documentsLoading: false })
      }
    },
    
    // Document editing actions
    setCurrentDocument: (document: Document | null) => set({ currentDocument: document }),
    setCurrentDocumentLoading: (loading: boolean) => set({ currentDocumentLoading: loading }),
    setCurrentDocumentSaving: (saving: boolean) => set({ currentDocumentSaving: saving }),
    setHasUnsavedChanges: (hasChanges: boolean) => set({ hasUnsavedChanges: hasChanges }),

    loadCurrentDocument: async (id: string) => {
      try {
        set({ currentDocumentLoading: true, currentDocument: null })
        const document = await apiClient.getDocument(id)
        set({ currentDocument: document, hasUnsavedChanges: false })
      } catch (error) {
        console.error('Failed to load document:', error)
        set({ currentDocument: null })
      } finally {
        set({ currentDocumentLoading: false })
      }
    },

    saveCurrentDocument: async () => {
      const { currentDocument } = get()
      if (!currentDocument) return

      try {
        set({ currentDocumentSaving: true })
        const updatedDocument = await apiClient.updateDocument(currentDocument.id, {
          title: currentDocument.title,
          content: currentDocument.content
        })
        set({ currentDocument: updatedDocument, hasUnsavedChanges: false })
      } catch (error) {
        console.error('Failed to save document:', error)
      } finally {
        set({ currentDocumentSaving: false })
      }
    },

    updateCurrentDocumentContent: (content: string) => {
      const { currentDocument } = get()
      if (!currentDocument) return
      
      set({
        currentDocument: { ...currentDocument, content },
        hasUnsavedChanges: true
      })
    },

    updateCurrentDocumentTitle: (title: string) => {
      const { currentDocument } = get()
      if (!currentDocument) return
      
      set({
        currentDocument: { ...currentDocument, title },
        hasUnsavedChanges: true
      })
    },
    
    signOut: async () => {
      await supabase.auth.signOut()
      set({ user: null, profile: null })
    },
    
    initializeAuth: async () => {
      try {
        set({ isLoading: true })
        
        // Get current session
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user) {
          const user: AuthUser = {
            id: session.user.id,
            email: session.user.email,
            user_metadata: session.user.user_metadata,
          }
          set({ user })
          
          // Fetch profile from backend
          try {
            const profile = await apiClient.getProfile()
            set({ profile })
          } catch (error) {
            console.error('Failed to fetch profile:', error)
          }
        } else {
          set({ user: null, profile: null })
        }

        // Listen for auth changes
        supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'SIGNED_IN' && session?.user) {
            const user: AuthUser = {
              id: session.user.id,
              email: session.user.email,
              user_metadata: session.user.user_metadata,
            }
            set({ user })
            
            // Fetch profile from backend
            try {
              const profile = await apiClient.getProfile()
              set({ profile })
            } catch (error) {
              console.error('Failed to fetch profile:', error)
            }
          } else if (event === 'SIGNED_OUT') {
            set({ user: null, profile: null })
          }
        })
      } catch (error) {
        console.error('Auth initialization failed:', error)
      } finally {
        set({ isLoading: false })
      }
    },
  }
}) 