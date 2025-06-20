'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LoginForm } from './LoginForm'
import { SignupForm } from './SignupForm'

export function AuthForm() {
  const [activeTab, setActiveTab] = useState('login')

  const handleAuthSuccess = () => {
    // The auth state change will be handled by the store listener
    // No need to do anything here
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">Sign In</TabsTrigger>
          <TabsTrigger value="signup">Sign Up</TabsTrigger>
        </TabsList>
        
        <TabsContent value="login" className="mt-6">
          <LoginForm onSuccess={handleAuthSuccess} />
        </TabsContent>
        
        <TabsContent value="signup" className="mt-6">
          <SignupForm onSuccess={handleAuthSuccess} />
        </TabsContent>
      </Tabs>
    </div>
  )
} 