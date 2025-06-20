'use client';

// frontend/src/app/dashboard/documents/[id]/page.tsx

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { DocumentResponse } from '@/types/api';
import { toast } from 'sonner';

interface DocumentPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function DocumentPage({ params }: DocumentPageProps) {
  const resolvedParams = React.use(params);
  const [document, setDocument] = useState<DocumentResponse | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        const doc = await apiClient.getDocument(resolvedParams.id);
        setDocument(doc);
        setTitle(doc.title);
        setContent(doc.content);
      } catch (error) {
        toast.error('Failed to load document');
        router.push('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchDocument();
  }, [resolvedParams.id, router]);

  useEffect(() => {
    if (document) {
      setHasChanges(
        title !== document.title || content !== document.content
      );
    }
  }, [title, content, document]);

  const handleSave = async () => {
    if (!document || !hasChanges) return;

    setSaving(true);
    try {
      const updatedDoc = await apiClient.updateDocument(document.id, {
        title: title.trim() || 'Untitled Document',
        content,
      });
      
      if (updatedDoc) {
        setDocument(updatedDoc);
        setHasChanges(false);
        toast.success('Document saved successfully');
      }
    } catch (error) {
      toast.error('Failed to save document');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <Header />
          <main className="container mx-auto px-4 py-8">
            <div className="max-w-4xl mx-auto">
              <Card>
                <CardHeader>
                  <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-96 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <Button
                variant="outline"
                onClick={() => router.push('/dashboard')}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Dashboard</span>
              </Button>
              
              <Button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className="flex items-center space-x-2"
              >
                <Save className="h-4 w-4" />
                <span>{saving ? 'Saving...' : 'Save'}</span>
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Document Editor</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium mb-2">
                    Title
                  </label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter document title"
                    className="text-lg font-semibold"
                  />
                </div>
                
                <div>
                  <label htmlFor="content" className="block text-sm font-medium mb-2">
                    Content
                  </label>
                  <textarea
                    id="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Start writing your document..."
                    className="w-full h-96 p-4 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                {hasChanges && (
                  <div className="text-sm text-amber-600 dark:text-amber-400">
                    You have unsaved changes
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
} 