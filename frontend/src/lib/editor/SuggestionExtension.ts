import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { Node } from '@tiptap/pm/model'

/**
 * SuggestionExtension - Custom TipTap extension for AI-powered writing suggestions
 * 
 * This extension handles rendering suggestion highlights (decorations) 
 * based on suggestion data passed from the editor component.
 * 
 * Features:
 * - Static suggestion highlighting using ProseMirror decorations
 * - Non-content-altering overlays for visual feedback
 * - Support for multiple concurrent suggestions
 */

export interface Suggestion {
  id: string
  start: number
  end: number
  message: string
}

export interface SuggestionOptions {
  suggestions: Suggestion[]
  suggestionClass: string
}

const suggestionPluginKey = new PluginKey('suggestions')

// Helper function to create decorations
function createDecorations(doc: Node, suggestions: Suggestion[], suggestionClass: string): DecorationSet {
  const decorations: Decoration[] = []
  
  suggestions.forEach(suggestion => {
    // Ensure the suggestion range is valid within the document
    if (suggestion.start >= 0 && 
        suggestion.end <= doc.content.size && 
        suggestion.start < suggestion.end) {
      
      try {
        // Create inline decoration for highlighting the text range
        const decoration = Decoration.inline(
          suggestion.start,
          suggestion.end,
          {
            class: suggestionClass,
            'data-suggestion-id': suggestion.id,
            'data-suggestion-message': suggestion.message,
          }
        )
        decorations.push(decoration)
      } catch (error) {
        // Silently handle invalid ranges
        console.warn('Invalid suggestion range:', suggestion, error)
      }
    }
  })
  
  return DecorationSet.create(doc, decorations)
}

export const SuggestionExtension = Extension.create<SuggestionOptions>({
  name: 'suggestions',
  
  addOptions() {
    return {
      suggestions: [],
      suggestionClass: 'suggestion-highlight',
    }
  },

  addProseMirrorPlugins() {
    const extensionOptions = this.options
    
    return [
      new Plugin({
        key: suggestionPluginKey,
        
        state: {
          init(_, { doc }) {
            return createDecorations(doc, extensionOptions.suggestions, extensionOptions.suggestionClass)
          },
          
          apply(transaction, decorationSet, oldState, newState) {
            // Get current suggestions from options
            const suggestions = extensionOptions.suggestions || []
            
            // Create new decorations based on current suggestions
            return createDecorations(newState.doc, suggestions, extensionOptions.suggestionClass)
          },
        },
        
        props: {
          decorations(state) {
            return this.getState(state)
          },
        },
      }),
    ]
  },

  onCreate() {
    console.log('SuggestionExtension initialized with decoration support')
  },
}) 