'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-2xl mx-auto text-center">
        <div className="flex justify-center mb-8">
          <div className="p-4 bg-primary/10 rounded-full">
            <FileText className="h-12 w-12 text-primary" />
          </div>
        </div>
        
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          AI Writing Assistant
        </h1>
        
        <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
          Your intelligent writing companion powered by AI. Get real-time suggestions, 
          grammar corrections, and style improvements as you write.
        </p>
        
        <div className="space-y-4">
          <Button
            size="lg"
            onClick={() => router.push('/auth')}
            className="text-lg px-8 py-3"
          >
            Get Started
          </Button>
          
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Sign up for free and start writing better content today
          </p>
        </div>
      </div>
    </div>
  );
}
