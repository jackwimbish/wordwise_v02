'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { SuggestionResponse } from '@/types'

interface SuggestionsPanelProps {
  suggestions: SuggestionResponse[]
  onAcceptSuggestion: (suggestion: SuggestionResponse) => void
  onDismissSuggestion: (suggestion: SuggestionResponse) => void
  onSuggestionClick?: (suggestion: SuggestionResponse) => void
}

// Helper function to check if an ID is a UUID
const isUUID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(id)
}

// Category display configuration
const categoryConfig = {
  spelling: {
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    badgeColor: 'bg-red-100 text-red-800',
    icon: '🔤',
    label: 'Spelling'
  },
  grammar: {
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    badgeColor: 'bg-blue-100 text-blue-800',
    icon: '📝',
    label: 'Grammar'
  },
  style: {
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    badgeColor: 'bg-purple-100 text-purple-800',
    icon: '✨',
    label: 'Style'
  }
}

export function SuggestionsPanel({
  suggestions,
  onAcceptSuggestion,
  onDismissSuggestion,
  onSuggestionClick
}: SuggestionsPanelProps) {
  if (suggestions.length === 0) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-4 text-center">
          <div className="space-y-2">
            <div className="text-2xl">✅</div>
            <p className="text-sm font-medium text-green-900">
              No writing issues found
            </p>
            <p className="text-xs text-green-700">
              Your text looks great!
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Group suggestions by category
  const groupedSuggestions = suggestions.reduce((groups, suggestion) => {
    const category = suggestion.category
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(suggestion)
    return groups
  }, {} as Record<string, SuggestionResponse[]>)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-900 text-sm">Writing Suggestions</h4>
        <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs font-medium">
          {suggestions.length} issue{suggestions.length !== 1 ? 's' : ''}
        </span>
      </div>
      
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {Object.entries(groupedSuggestions).map(([category, categorySuggestions]) => {
          const config = categoryConfig[category as keyof typeof categoryConfig]
          
          return (
            <div key={category} className="space-y-1">
              {/* Category header */}
              <div className="flex items-center gap-2 text-xs font-medium text-gray-600">
                <span>{config.icon}</span>
                <span>{config.label}</span>
                <span className={`${config.badgeColor} px-1.5 py-0.5 rounded text-xs font-medium`}>
                  {categorySuggestions.length}
                </span>
              </div>
              
              {/* Suggestions in this category */}
              {categorySuggestions.map((suggestion) => {
                // Check if this suggestion is from a UUID-based paragraph
                const suggestionParagraphId = (suggestion as SuggestionResponse & { paragraph_id?: string }).paragraph_id
                const isFromUuidParagraph = suggestionParagraphId && isUUID(suggestionParagraphId)
                
                return (
                  <Card 
                    key={suggestion.suggestion_id}
                    className={`${config.borderColor} hover:shadow-sm transition-shadow cursor-pointer`}
                    onClick={() => onSuggestionClick?.(suggestion)}
                  >
                    <CardContent className="p-3 space-y-2">
                      {/* Debug badge for UUID-based paragraphs */}
                      {process.env.NODE_ENV === 'development' && (
                        <div className="flex items-center gap-1 mb-1">
                          {isFromUuidParagraph ? (
                            <span className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-xs font-medium">
                              UUID
                            </span>
                          ) : (
                            <span className="bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded text-xs font-medium">
                              POS
                            </span>
                          )}
                          {suggestionParagraphId && (
                            <span className="text-xs text-gray-500 font-mono">
                              {suggestionParagraphId.slice(0, 8)}...
                            </span>
                          )}
                        </div>
                      )}
                      
                      {/* Original and suggested text */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded font-medium">
                            FROM
                          </span>
                          <span className="font-mono text-red-800 bg-red-50 px-1.5 py-0.5 rounded text-xs">
                            &ldquo;{suggestion.original_text}&rdquo;
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-green-600 bg-green-50 px-1.5 py-0.5 rounded font-medium">
                            TO
                          </span>
                          <span className="font-mono text-green-800 bg-green-50 px-1.5 py-0.5 rounded text-xs">
                            &ldquo;{suggestion.suggestion_text}&rdquo;
                          </span>
                        </div>
                      </div>
                      
                      {/* Message */}
                      <p className="text-xs text-gray-600 leading-snug">
                        {suggestion.message}
                      </p>
                      
                      {/* Action buttons */}
                      <div className="flex gap-1.5 pt-1">
                        <Button
                          size="sm"
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation()
                            onAcceptSuggestion(suggestion)
                          }}
                          className="flex-1 h-7 text-xs"
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation()
                            onDismissSuggestion(suggestion)
                          }}
                          className="flex-1 h-7 text-xs"
                        >
                          Dismiss
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
} 