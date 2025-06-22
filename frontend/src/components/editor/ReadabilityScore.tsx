'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import rs from 'text-readability'

interface ReadabilityStats {
  fleschReadingEase: number
  fleschKincaidGrade: number
  gunningFog: number
  automatedReadabilityIndex: number
  colemanLiauIndex: number
  smogIndex: number
  daleChallReadabilityScore: number
  wordCount: number
  sentenceCount: number
  syllableCount: number
  textStandard: string
  difficultWords: number
}

interface ReadabilityScoreProps {
  text: string
}

export function ReadabilityScore({ text }: ReadabilityScoreProps) {
  const [stats, setStats] = useState<ReadabilityStats | null>(null)

  useEffect(() => {
    if (!text || text.trim().length === 0) {
      setStats(null)
      return
    }

    try {
      const newStats: ReadabilityStats = {
        fleschReadingEase: rs.fleschReadingEase(text),
        fleschKincaidGrade: rs.fleschKincaidGrade(text),
        gunningFog: rs.gunningFog(text),
        automatedReadabilityIndex: rs.automatedReadabilityIndex(text),
        colemanLiauIndex: rs.colemanLiauIndex(text),
        smogIndex: rs.smogIndex(text),
        daleChallReadabilityScore: rs.daleChallReadabilityScore(text),
        wordCount: rs.lexiconCount(text),
        sentenceCount: rs.sentenceCount(text),
        syllableCount: rs.syllableCount(text),
        textStandard: rs.textStandard(text),
        difficultWords: rs.difficultWords(text),
      }

      setStats(newStats)
    } catch (error) {
      console.error('Error calculating readability stats:', error)
      setStats(null)
    }
  }, [text])

  if (!stats) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg">Readability Score</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Start writing to see readability statistics
          </p>
        </CardContent>
      </Card>
    )
  }

  const getReadabilityLabel = (score: number): { label: string; color: string } => {
    if (score >= 90) return { label: 'Very Easy', color: 'text-green-600' }
    if (score >= 80) return { label: 'Easy', color: 'text-green-500' }
    if (score >= 70) return { label: 'Fairly Easy', color: 'text-blue-500' }
    if (score >= 60) return { label: 'Standard', color: 'text-blue-600' }
    if (score >= 50) return { label: 'Fairly Difficult', color: 'text-yellow-600' }
    if (score >= 30) return { label: 'Difficult', color: 'text-orange-600' }
    return { label: 'Very Confusing', color: 'text-red-600' }
  }

  const readabilityInfo = getReadabilityLabel(stats.fleschReadingEase)

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">Readability Score</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Primary Score */}
        <div className="p-3 bg-muted rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Flesch Reading Ease</span>
            <span className="text-lg font-bold">{stats.fleschReadingEase.toFixed(1)}</span>
          </div>
          <div className={`text-sm ${readabilityInfo.color} font-medium`}>
            {readabilityInfo.label}
          </div>
        </div>

        {/* Grade Level */}
        <div className="p-3 bg-muted rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Grade Level</span>
            <span className="text-lg font-bold">{stats.textStandard}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Flesch-Kincaid: {stats.fleschKincaidGrade.toFixed(1)}
          </div>
        </div>

        {/* Basic Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-2 bg-muted rounded">
            <div className="text-xs text-muted-foreground">Words</div>
            <div className="text-sm font-medium">{stats.wordCount}</div>
          </div>
          <div className="p-2 bg-muted rounded">
            <div className="text-xs text-muted-foreground">Sentences</div>
            <div className="text-sm font-medium">{stats.sentenceCount}</div>
          </div>
          <div className="p-2 bg-muted rounded">
            <div className="text-xs text-muted-foreground">Syllables</div>
            <div className="text-sm font-medium">{stats.syllableCount}</div>
          </div>
          <div className="p-2 bg-muted rounded">
            <div className="text-xs text-muted-foreground">Difficult Words</div>
            <div className="text-sm font-medium">{stats.difficultWords}</div>
          </div>
        </div>

        {/* Additional Metrics */}
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
            More Metrics
          </summary>
          <div className="mt-2 space-y-2">
            <div className="flex justify-between">
              <span>Gunning Fog:</span>
              <span className="font-medium">{stats.gunningFog.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span>ARI:</span>
              <span className="font-medium">{stats.automatedReadabilityIndex.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span>Coleman-Liau:</span>
              <span className="font-medium">{stats.colemanLiauIndex.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span>SMOG:</span>
              <span className="font-medium">{stats.smogIndex.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span>Dale-Chall:</span>
              <span className="font-medium">{stats.daleChallReadabilityScore.toFixed(1)}</span>
            </div>
          </div>
        </details>
      </CardContent>
    </Card>
  )
} 