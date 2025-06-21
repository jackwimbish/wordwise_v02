'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { SuggestionResponse } from '@/types'

interface SuggestionPopupProps {
  suggestion: SuggestionResponse | null
  isVisible: boolean
  position: { x: number; y: number; positionAbove?: boolean }
  onAccept: (suggestion: SuggestionResponse) => void
  onDismiss: (suggestion: SuggestionResponse) => void
  onClose: () => void
}

// Category display configuration
const categoryConfig = {
  spelling: {
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: '🔤',
    label: 'Spelling'
  },
  grammar: {
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    icon: '📝',
    label: 'Grammar'
  },
  style: {
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    icon: '✨',
    label: 'Style'
  }
}

export function SuggestionPopup({
  suggestion,
  isVisible,
  position,
  onAccept,
  onDismiss,
  onClose
}: SuggestionPopupProps) {
  // Don't render if not visible or no suggestion
  if (!isVisible || !suggestion) {
    return null
  }

  const config = categoryConfig[suggestion.category]

  // Calculate transform based on position preference
  const getTransform = () => {
    const horizontalCenter = 'translateX(-50%)'
    
    if (position.positionAbove === false) {
      // Position below the text: popup top should be at the y position + small margin
      return `${horizontalCenter} translateY(10px)`
    } else {
      // Position above the text: popup bottom should be at the y position - small margin
      return `${horizontalCenter} translateY(calc(-100% - 10px))`
    }
  }

  // Handle click outside to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black bg-opacity-10"
        onClick={handleBackdropClick}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      />


      {/* Popup Card */}
      <div
        className="fixed z-50 w-80 max-w-sm"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform: getTransform(),
        }}
      >
        <Card className={`shadow-lg border-2 ${config.borderColor} ${config.bgColor}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className={`text-sm font-medium flex items-center gap-2 ${config.color}`}>
                <span className="text-base">{config.icon}</span>
                {config.label}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-gray-100"
                onClick={onClose}
                aria-label="Close suggestion"
              >
                ×
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="pt-0 space-y-4">
            {/* Original and suggested text comparison */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                Change
              </div>
              <div className="bg-white rounded-md border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded">
                    FROM
                  </span>
                  <span className="text-sm font-mono bg-red-50 px-2 py-1 rounded text-red-800">
                    &ldquo;{suggestion.original_text}&rdquo;
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded">
                    TO
                  </span>
                  <span className="text-sm font-mono bg-green-50 px-2 py-1 rounded text-green-800">
                    &ldquo;{suggestion.suggestion_text}&rdquo;
                  </span>
                </div>
              </div>
            </div>

            {/* Explanation */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                Explanation
              </div>
              <CardDescription className="text-sm leading-relaxed">
                {suggestion.message}
              </CardDescription>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => onAccept(suggestion)}
                className="flex-1 text-sm"
                size="sm"
              >
                Accept
              </Button>
              <Button
                onClick={() => onDismiss(suggestion)}
                variant="outline"
                className="flex-1 text-sm"
                size="sm"
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
} 