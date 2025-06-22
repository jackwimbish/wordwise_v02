'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface FileUploadProps {
  onFileSelect: (file: File) => void
  accept?: string
  maxSize?: number // in bytes
  disabled?: boolean
  className?: string
}

export function FileUpload({
  onFileSelect,
  accept = '.txt,.pdf,.docx',
  maxSize = 30 * 1024 * 1024, // 30MB
  disabled = false,
  className = ''
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = useCallback((file: File): string | null => {
    // Check file size
    if (file.size > maxSize) {
      return `File size exceeds ${Math.round(maxSize / (1024 * 1024))}MB limit`
    }

    // Check file type
    const allowedExtensions = accept.split(',').map(ext => ext.trim().toLowerCase())
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
    
    if (!allowedExtensions.includes(fileExtension)) {
      return `Unsupported file type. Allowed types: ${allowedExtensions.join(', ')}`
    }

    return null
  }, [accept, maxSize])

  const handleFileSelect = useCallback((file: File) => {
    const error = validateFile(file)
    if (error) {
      alert(error)
      return
    }

    onFileSelect(file)
  }, [onFileSelect, validateFile])

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
    // Reset the input value so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) {
      setIsDragOver(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    if (disabled) return

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleButtonClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  return (
    <Card 
      className={`transition-colors ${
        isDragOver 
          ? 'border-blue-500 bg-blue-50' 
          : 'border-dashed border-gray-300 hover:border-gray-400'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleButtonClick}
    >
      <CardContent className="p-6 text-center">
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
        />
        
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
            <svg 
              className="w-6 h-6 text-gray-600" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
              />
            </svg>
          </div>
          
          <div>
            <p className="text-sm font-medium text-gray-900 mb-1">
              {isDragOver ? 'Drop your file here' : 'Import a document'}
            </p>
            <p className="text-xs text-gray-500">
              Drag and drop or click to select
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Supports: TXT, PDF, DOCX (max {Math.round(maxSize / (1024 * 1024))}MB)
            </p>
          </div>
          
          <Button 
            variant="outline" 
            size="sm"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation()
              handleButtonClick()
            }}
          >
            Choose File
          </Button>
        </div>
      </CardContent>
    </Card>
  )
} 