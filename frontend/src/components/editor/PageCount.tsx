'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  PageCountSettings, 
  DEFAULT_PAGE_SETTINGS, 
  calculatePageCount 
} from '@/lib/utils'

interface PageCountProps {
  text: string
  settings?: PageCountSettings
  onSettingsChange?: (settings: PageCountSettings) => void
}

export function PageCount({ text, settings: propSettings, onSettingsChange }: PageCountProps) {
  // Use local state for settings if not provided as props
  const [localSettings, setLocalSettings] = useState<PageCountSettings>(DEFAULT_PAGE_SETTINGS)
  const [pageCount, setPageCount] = useState(0)
  
  // Use prop settings if provided, otherwise use local settings
  const settings = propSettings || localSettings

  useEffect(() => {
    const count = calculatePageCount(text, settings)
    setPageCount(count)
  }, [text, settings])

  const updateSetting = <K extends keyof PageCountSettings>(
    key: K,
    value: PageCountSettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value }
    
    if (onSettingsChange) {
      // If using prop settings, notify parent of change
      onSettingsChange(newSettings)
    } else {
      // If using local settings, update local state
      setLocalSettings(newSettings)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">Page Count Estimate</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Primary Page Count Display */}
        <div className="p-3 bg-muted rounded-lg text-center">
          <div className="text-2xl font-bold text-blue-600">
            {pageCount < 0.1 && text.trim() 
              ? '<0.1' 
              : pageCount.toFixed(1)
            }
          </div>
          <div className="text-sm text-muted-foreground">
            {pageCount === 1 ? 'page' : 'pages'}
          </div>
        </div>

        {/* Settings */}
        <div className="space-y-3">
          {/* Font Family */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Font Family</label>
            <select
              value={settings.fontFamily}
              onChange={(e) => updateSetting('fontFamily', e.target.value)}
              className="w-full mt-1 p-2 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="times">Times New Roman</option>
              <option value="arial">Arial</option>
              <option value="calibri">Calibri</option>
              <option value="helvetica">Helvetica</option>
            </select>
          </div>

          {/* Font Size */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Font Size</label>
            <select
              value={settings.fontSize.toString()}
              onChange={(e) => updateSetting('fontSize', parseInt(e.target.value))}
              className="w-full mt-1 p-2 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="10">10pt</option>
              <option value="11">11pt</option>
              <option value="12">12pt</option>
              <option value="14">14pt</option>
              <option value="16">16pt</option>
              <option value="18">18pt</option>
            </select>
          </div>

          {/* Paper Size */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Paper Size</label>
            <select
              value={settings.paperSize}
              onChange={(e) => updateSetting('paperSize', e.target.value)}
              className="w-full mt-1 p-2 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="letter">US Letter (8.5×11&quot;)</option>
              <option value="a4">A4 (8.27×11.69&quot;)</option>
              <option value="legal">US Legal (8.5×14&quot;)</option>
            </select>
          </div>

          {/* Line Spacing */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Line Spacing</label>
            <select
              value={settings.lineSpacing}
              onChange={(e) => updateSetting('lineSpacing', e.target.value)}
              className="w-full mt-1 p-2 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="single">Single</option>
              <option value="1.5">1.5 Lines</option>
              <option value="double">Double</option>
            </select>
          </div>

          {/* Margins */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Margins</label>
            <select
              value={settings.margins}
              onChange={(e) => updateSetting('margins', e.target.value)}
              className="w-full mt-1 p-2 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="0.5inch">0.5 inch</option>
              <option value="1inch">1 inch</option>
              <option value="1.5inch">1.5 inch</option>
            </select>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="pt-2 border-t">
          <div className="text-xs text-muted-foreground space-y-1">
            <div>
              Characters: {text.replace(/\s+/g, ' ').trim().length.toLocaleString()}
            </div>
            <div className="italic">
              * Estimates based on standard formatting
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 