'use client';

// frontend/src/components/documents/DocumentCard.tsx

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DocumentListItem } from '@/types/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { Trash2, FileText, Calendar } from 'lucide-react';

interface DocumentCardProps {
  document: DocumentListItem;
  onDelete: (id: string) => Promise<boolean>;
}

export function DocumentCard({ document, onDelete }: DocumentCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setDeleting(true);
    const success = await onDelete(document.id);
    if (success) {
      setShowDeleteDialog(false);
    }
    setDeleting(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1" onClick={() => router.push(`/dashboard/documents/${document.id}`)}>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {document.title}
              </CardTitle>
              <CardDescription className="flex items-center gap-1 mt-1">
                <Calendar className="h-3 w-3" />
                Updated {formatDate(document.updated_at)}
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteDialog(true);
              }}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex justify-between items-center text-sm text-gray-500">
            <span>Created {formatDate(document.created_at)}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/dashboard/documents/${document.id}`)}
            >
              Open
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{document.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
} 