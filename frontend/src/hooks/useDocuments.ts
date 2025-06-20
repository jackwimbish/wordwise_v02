'use client';

// frontend/src/hooks/useDocuments.ts

import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';
import { DocumentListResponse, DocumentResponse, DocumentCreate, DocumentUpdate } from '@/types/api';
import { toast } from 'sonner';

export function useDocuments() {
  const [documents, setDocuments] = useState<DocumentListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getDocuments();
      setDocuments(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch documents';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const createDocument = useCallback(async (data: DocumentCreate): Promise<DocumentResponse | null> => {
    try {
      const newDocument = await apiClient.createDocument(data);
      // Refresh the documents list
      await fetchDocuments();
      toast.success('Document created successfully');
      return newDocument;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create document';
      toast.error(errorMessage);
      return null;
    }
  }, [fetchDocuments]);

  const updateDocument = useCallback(async (id: string, data: DocumentUpdate): Promise<DocumentResponse | null> => {
    try {
      const updatedDocument = await apiClient.updateDocument(id, data);
      // Refresh the documents list
      await fetchDocuments();
      toast.success('Document updated successfully');
      return updatedDocument;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update document';
      toast.error(errorMessage);
      return null;
    }
  }, [fetchDocuments]);

  const deleteDocument = useCallback(async (id: string): Promise<boolean> => {
    try {
      await apiClient.deleteDocument(id);
      // Refresh the documents list
      await fetchDocuments();
      toast.success('Document deleted successfully');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete document';
      toast.error(errorMessage);
      return false;
    }
  }, [fetchDocuments]);

  return {
    documents,
    loading,
    error,
    fetchDocuments,
    createDocument,
    updateDocument,
    deleteDocument,
  };
} 