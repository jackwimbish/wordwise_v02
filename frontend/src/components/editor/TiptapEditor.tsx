'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Button } from '@/components/ui/button'

interface TiptapEditorProps {
  content: string
  onUpdate: (content: string) => void
  placeholder?: string
  editable?: boolean
}

export function TiptapEditor({ 
  content, 
  onUpdate, 
  placeholder = 'Start writing...', 
  editable = true 
}: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onUpdate(editor.getHTML())
    },
  })

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
        }
        .editor-content .ProseMirror p {
          margin: 0.5rem 0 !important;
        }
        .editor-content .ProseMirror p:first-child {
          margin-top: 0 !important;
        }
        .editor-content .ProseMirror p:last-child {
          margin-bottom: 0 !important;
        }
        .editor-content .ProseMirror h1,
        .editor-content .ProseMirror h2,
        .editor-content .ProseMirror h3 {
          margin: 1rem 0 0.5rem 0 !important;
        }
        .editor-content .ProseMirror h1:first-child,
        .editor-content .ProseMirror h2:first-child,
        .editor-content .ProseMirror h3:first-child {
          margin-top: 0 !important;
        }
      `}</style>
    </div>
  )
} 