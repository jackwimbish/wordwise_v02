'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/lib/store'

export function AppProvider({ children }: { children: React.ReactNode }) {
  const initializeAuth = useAppStore((state) => state.initializeAuth)

  useEffect(() => {
    initializeAuth()
  }, [initializeAuth])

  return (
    <>
      {children}
    </>
  )
} 