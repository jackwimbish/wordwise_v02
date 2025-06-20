'use client';

// frontend/src/app/dashboard/page.tsx

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Header } from '@/components/layout/Header';
import { DocumentList } from '@/components/documents/DocumentList';

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <DocumentList />
        </main>
      </div>
    </ProtectedRoute>
  );
} 