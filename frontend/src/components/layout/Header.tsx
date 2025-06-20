'use client';

// frontend/src/components/layout/Header.tsx

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, User, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export function Header() {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
      router.push('/auth');
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };

  return (
    <header className="border-b bg-white dark:bg-gray-900">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">AI Writing Assistant</h1>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4" />
              <span className="text-sm font-medium">
                {profile?.display_name || user?.email}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="flex items-center space-x-2"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
} 