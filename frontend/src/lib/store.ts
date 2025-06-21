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
  refreshDocuments: () => Promise<void>
  deleteDocument: (id: string) => Promise<void>
  
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
      const { documentsLoading } = get()
      
      // Prevent multiple simultaneous calls or unnecessary reloads
      if (documentsLoading) return
      
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

    refreshDocuments: async () => {
      const { documentsLoading } = get()
      
      // Prevent multiple simultaneous calls
      if (documentsLoading) return
      
      try {
        set({ documentsLoading: true })
        const response = await apiClient.getDocuments()
        set({ documents: response.documents })
      } catch (error) {
        console.error('Failed to refresh documents:', error)
      } finally {
        set({ documentsLoading: false })
      }
    },

    deleteDocument: async (id: string) => {
      try {
        await apiClient.deleteDocument(id)
        
        // Remove the deleted document from the local state
        const { documents } = get()
        const updatedDocuments = documents.filter(doc => doc.id !== id)
        set({ documents: updatedDocuments })
        
        // If the current document is the one being deleted, clear it
        const { currentDocument } = get()
        if (currentDocument?.id === id) {
          set({ currentDocument: null, hasUnsavedChanges: false })
        }
      } catch (error) {
        console.error('Failed to delete document:', error)
        throw error // Re-throw so the UI can handle the error
      }
    },
    
    // Document editing actions
    setCurrentDocument: (document: Document | null) => set({ currentDocument: document }),
    setCurrentDocumentLoading: (loading: boolean) => set({ currentDocumentLoading: loading }),
    setCurrentDocumentSaving: (saving: boolean) => set({ currentDocumentSaving: saving }),
    setHasUnsavedChanges: (hasChanges: boolean) => set({ hasUnsavedChanges: hasChanges }),

    loadCurrentDocument: async (id: string) => {
      const { currentDocumentLoading } = get()
      
      // Prevent multiple simultaneous calls
      if (currentDocumentLoading) return
      
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
        
        // Only update metadata fields, preserve the current content in the editor
        set({ 
          currentDocument: {
            ...currentDocument, // Keep current content and title as-is
            id: updatedDocument.id,
            profile_id: updatedDocument.profile_id,
            updated_at: updatedDocument.updated_at,
            created_at: updatedDocument.created_at
          }, 
          hasUnsavedChanges: false 
        })
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
      set({ 
        user: null, 
        profile: null, 
        documents: [], 
        currentDocument: null,
        hasUnsavedChanges: false
      })
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
            set({ 
              user: null, 
              profile: null, 
              documents: [], 
              currentDocument: null,
              hasUnsavedChanges: false
            })
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