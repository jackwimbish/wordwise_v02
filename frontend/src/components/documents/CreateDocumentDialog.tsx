'use client';

// frontend/src/components/documents/CreateDocumentDialog.tsx

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { DocumentCreate } from '@/types/api';

interface CreateDocumentDialogProps {
  onCreateDocument: (data: DocumentCreate) => Promise<any>;
}

export function CreateDocumentDialog({ onCreateDocument }: CreateDocumentDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      return;
    }

    setLoading(true);
    try {
      const newDocument = await onCreateDocument({
        title: title.trim(),
        content: '',
      });
      
      if (newDocument) {
        setOpen(false);
        setTitle('');
        // Navigate to the new document
        router.push(`/dashboard/documents/${newDocument.id}`);
      }
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Document
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Document</DialogTitle>
            <DialogDescription>
              Enter a title for your new document. You can start writing immediately after creation.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right">
                Title
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter document title"
                className="col-span-3"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !title.trim()}>
              {loading ? 'Creating...' : 'Create Document'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 