import { useEffect, useRef, useCallback } from 'react'

/**
 * Hook to handle tab visibility changes and prevent unnecessary API calls
 * during tab switches while providing automatic refresh when tab becomes active
 */
export function useTabVisibility(
  onTabVisible?: () => void,
  refreshThresholdMs: number = 5000
) {
  const isTabVisible = useRef(true)
  const lastRefreshTime = useRef<number>(0)

  const handleVisibilityChange = useCallback(() => {
    const wasVisible = isTabVisible.current
    isTabVisible.current = !document.hidden
    
    // If tab becomes visible and it's been a while since last refresh
    if (!wasVisible && isTabVisible.current && onTabVisible) {
      const timeSinceLastRefresh = Date.now() - lastRefreshTime.current
      if (timeSinceLastRefresh > refreshThresholdMs) {
        lastRefreshTime.current = Date.now()
        onTabVisible()
      }
    }
  }, [onTabVisible, refreshThresholdMs])

  const handleFocus = useCallback(() => {
    const wasVisible = isTabVisible.current
    isTabVisible.current = true
    
    // If window gains focus and it's been a while since last refresh
    if (!wasVisible && onTabVisible) {
      const timeSinceLastRefresh = Date.now() - lastRefreshTime.current
      if (timeSinceLastRefresh > refreshThresholdMs) {
        lastRefreshTime.current = Date.now()
        onTabVisible()
      }
    }
  }, [onTabVisible, refreshThresholdMs])

  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [handleVisibilityChange, handleFocus])

  return {
    isTabVisible: isTabVisible.current,
    markRefreshed: () => {
      lastRefreshTime.current = Date.now()
    }
  }
}

/**
 * Hook to create stable references for functions that depend on primitive values
 * This prevents unnecessary useEffect re-runs when objects are recreated with same data
 */
export function useStableCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  deps: unknown[]
): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(callback, deps)
} 