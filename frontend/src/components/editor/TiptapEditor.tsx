'use client'

import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Extension } from '@tiptap/core'
import { Button } from '@/components/ui/button'

interface TiptapEditorProps {
  content: string
  onUpdate: (content: string) => void
  placeholder?: string
  editable?: boolean
}

// Custom extension to handle Shift+Enter for hard breaks
const CustomKeyboardShortcuts = Extension.create({
  name: 'customKeyboardShortcuts',

  addKeyboardShortcuts() {
    return {
      'Shift-Enter': () => this.editor.commands.setHardBreak(),
    }
  },
})

export function TiptapEditor({ 
  content, 
  onUpdate, 
  placeholder = 'Start writing...', 
  editable = true 
}: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Configure paragraph behavior to maintain consistent spacing
        paragraph: {
          HTMLAttributes: {
            class: 'tiptap-paragraph',
          },
        },
        // Configure hard break behavior for better line spacing
        hardBreak: {
          keepMarks: false,
          HTMLAttributes: {
            class: 'tiptap-hard-break',
          },
        },
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      CustomKeyboardShortcuts,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onUpdate(editor.getHTML())
    },
  })

  // Sync content when it changes externally
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, false)
    }
  }, [editor, content])

  if (!editor) {
    return null
  }

  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      {/* Toolbar */}
      <div className="border-b border-gray-200 p-2 flex flex-wrap gap-1">
        <Button
          type="button"
          variant={editor.isActive('bold') ? 'default' : 'outline'}
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
        >
          Bold
        </Button>
        
        <Button
          type="button"
          variant={editor.isActive('italic') ? 'default' : 'outline'}
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
        >
          Italic
        </Button>

        <Button
          type="button"
          variant={editor.isActive('strike') ? 'default' : 'outline'}
          size="sm"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={!editor.can().chain().focus().toggleStrike().run()}
        >
          Strike
        </Button>

        <div className="w-px bg-gray-300 mx-1" />

        <Button
          type="button"
          variant={editor.isActive('heading', { level: 1 }) ? 'default' : 'outline'}
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          H1
        </Button>

        <Button
          type="button"
          variant={editor.isActive('heading', { level: 2 }) ? 'default' : 'outline'}
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </Button>

        <Button
          type="button"
          variant={editor.isActive('heading', { level: 3 }) ? 'default' : 'outline'}
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </Button>

        <div className="w-px bg-gray-300 mx-1" />

        <Button
          type="button"
          variant={editor.isActive('bulletList') ? 'default' : 'outline'}
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          Bullet List
        </Button>

        <Button
          type="button"
          variant={editor.isActive('orderedList') ? 'default' : 'outline'}
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          Numbered List
        </Button>

        <div className="w-px bg-gray-300 mx-1" />

        <Button
          type="button"
          variant={editor.isActive('blockquote') ? 'default' : 'outline'}
          size="sm"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          Quote
        </Button>

        <Button
          type="button"
          variant={editor.isActive('codeBlock') ? 'default' : 'outline'}
          size="sm"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          Code Block
        </Button>

        <div className="w-px bg-gray-300 mx-1" />

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
        >
          Undo
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
        >
          Redo
        </Button>
        
        <div className="flex-1" />
        
        <div className="text-xs text-gray-500 flex items-center">
          <span>Enter: New paragraph • Shift+Enter: Line break</span>
        </div>
      </div>

      {/* Editor Content */}
      <div className="p-4">
        <div className="editor-content">
          <EditorContent 
            editor={editor} 
            className="prose prose-sm max-w-none focus:outline-none"
          />
        </div>
      </div>
      
      <style jsx global>{`
        .editor-content .ProseMirror {
          outline: none !important;
          line-height: 1.6 !important;
        }
        
        /* Paragraph styling - reduce margins for consistent spacing */
        .editor-content .ProseMirror p {
          margin: 0 0 0.75rem 0 !important;
          line-height: 1.6 !important;
        }
        
        .editor-content .ProseMirror p:first-child {
          margin-top: 0 !important;
        }
        
        .editor-content .ProseMirror p:last-child {
          margin-bottom: 0 !important;
        }
        
        /* Hard break styling - minimal spacing for single line breaks */
        .editor-content .ProseMirror br.tiptap-hard-break {
          content: "";
          display: block;
          margin: 0 !important;
          padding: 0 !important;
          line-height: 0.3 !important;
        }
        
        /* Empty paragraphs should have minimal height */
        .editor-content .ProseMirror p:empty {
          margin: 0 0 0.3rem 0 !important;
          min-height: 1em !important;
        }
        
        /* Consecutive empty paragraphs */
        .editor-content .ProseMirror p:empty + p:empty {
          margin-top: 0 !important;
        }
        
        /* Heading styles */
        .editor-content .ProseMirror h1,
        .editor-content .ProseMirror h2,
        .editor-content .ProseMirror h3 {
          margin: 1.5rem 0 0.75rem 0 !important;
          line-height: 1.3 !important;
        }
        
        .editor-content .ProseMirror h1:first-child,
        .editor-content .ProseMirror h2:first-child,
        .editor-content .ProseMirror h3:first-child {
          margin-top: 0 !important;
        }
        
        /* List styling */
        .editor-content .ProseMirror ul,
        .editor-content .ProseMirror ol {
          margin: 0.5rem 0 !important;
          padding-left: 1.5rem !important;
        }
        
        .editor-content .ProseMirror li {
          margin: 0.25rem 0 !important;
        }
        
        /* Blockquote styling */
        .editor-content .ProseMirror blockquote {
          margin: 1rem 0 !important;
          padding-left: 1rem !important;
          border-left: 3px solid #d1d5db !important;
          color: #6b7280 !important;
        }
        
        /* Code block styling */
        .editor-content .ProseMirror pre {
          margin: 1rem 0 !important;
          padding: 0.75rem !important;
          background-color: #f3f4f6 !important;
          border-radius: 0.375rem !important;
          overflow-x: auto !important;
        }
        
        .editor-content .ProseMirror code {
          background-color: #f3f4f6 !important;
          padding: 0.125rem 0.25rem !important;
          border-radius: 0.25rem !important;
          font-size: 0.875em !important;
        }
      `}</style>
    </div>
  )
} 