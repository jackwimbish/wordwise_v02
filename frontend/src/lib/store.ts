import { create } from 'zustand'
import { createClient } from './supabase'
import { createApiClient, type ApiClient } from './api'
import type { AuthUser, Profile } from '@/types'

interface AppState {
  // Auth state
  user: AuthUser | null
  profile: Profile | null
  isLoading: boolean
  
  // API client
  apiClient: ApiClient
  
  // Actions
  setUser: (user: AuthUser | null) => void
  setProfile: (profile: Profile | null) => void
  setLoading: (loading: boolean) => void
  signOut: () => Promise<void>
  
  // Initialize auth
  initializeAuth: () => Promise<void>
}

export const useAppStore = create<AppState>((set) => {
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
    apiClient,
    
    setUser: (user) => set({ user }),
    setProfile: (profile) => set({ profile }),
    setLoading: (isLoading) => set({ isLoading }),
    
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