'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Download, FileText, FileType, File } from 'lucide-react'

interface ExportButtonProps {
  title: string
  content: string
  disabled?: boolean
}

export function ExportButton({ title, content, disabled = false }: ExportButtonProps) {
  const { exportDocument } = useAppStore()
  const [exporting, setExporting] = useState<string | null>(null)

  const handleExport = async (format: 'txt' | 'docx' | 'pdf') => {
    if (!title || !content) return

    try {
      setExporting(format)
      await exportDocument(title, content, format)
    } catch (error) {
      console.error(`Failed to export as ${format}:`, error)
      alert(`Failed to export document as ${format.toUpperCase()}. Please try again.`)
    } finally {
      setExporting(null)
    }
  }

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'txt':
        return <FileText className="w-4 h-4" />
      case 'docx':  
        return <FileType className="w-4 h-4" />
      case 'pdf':
        return <File className="w-4 h-4" />
      default:
        return <Download className="w-4 h-4" />
    }
  }

  const isExporting = !!exporting

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || isExporting || !title || !content}
          className="flex items-center gap-2"
        >
          {isExporting ? (
            <>
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></div>
              Exporting...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Export
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={() => handleExport('txt')}
          disabled={isExporting}
          className="cursor-pointer"
        >
          <div className="flex items-center gap-2">
            {getFormatIcon('txt')}
            <div className="flex flex-col">
              <span className="font-medium">Plain Text</span>
              <span className="text-xs text-gray-500">Export as .txt file</span>
            </div>
          </div>
        </DropdownMenuItem>
        
        <DropdownMenuItem
          onClick={() => handleExport('docx')}
          disabled={isExporting}
          className="cursor-pointer"
        >
          <div className="flex items-center gap-2">
            {getFormatIcon('docx')}
            <div className="flex flex-col">
              <span className="font-medium">Word Document</span>
              <span className="text-xs text-gray-500">Export as .docx file</span>
            </div>
          </div>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem
          onClick={() => handleExport('pdf')}
          disabled={isExporting}
          className="cursor-pointer"
        >
          <div className="flex items-center gap-2">
            {getFormatIcon('pdf')}
            <div className="flex flex-col">
              <span className="font-medium">PDF Document</span>
              <span className="text-xs text-gray-500">Export as .pdf file</span>
            </div>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 