'use client';

// frontend/src/components/documents/DocumentList.tsx

import { useEffect } from 'react';
import { useDocuments } from '@/hooks/useDocuments';
import { DocumentCard } from './DocumentCard';
import { CreateDocumentDialog } from './CreateDocumentDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Plus } from 'lucide-react';

export function DocumentList() {
  const { documents, loading, error, fetchDocuments, createDocument, deleteDocument } = useDocuments();

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  if (loading && !documents) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">My Documents</h2>
          <CreateDocumentDialog onCreateDocument={createDocument} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-3 bg-gray-200 rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const hasDocuments = documents && documents.documents.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">My Documents</h2>
          <p className="text-gray-600 dark:text-gray-400">
            {documents ? `${documents.total} document${documents.total !== 1 ? 's' : ''}` : 'Loading...'}
          </p>
        </div>
        <CreateDocumentDialog onCreateDocument={createDocument} />
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-800">Error: {error}</p>
          </CardContent>
        </Card>
      )}

      {hasDocuments ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.documents.map((document) => (
            <DocumentCard
              key={document.id}
              document={document}
              onDelete={deleteDocument}
            />
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <CardContent>
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full">
                <FileText className="h-8 w-8 text-gray-400" />
              </div>
              <div>
                <CardTitle className="text-xl mb-2">No documents yet</CardTitle>
                <CardDescription className="mb-4">
                  Create your first document to get started with AI-powered writing assistance.
                </CardDescription>
                <CreateDocumentDialog onCreateDocument={createDocument} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 