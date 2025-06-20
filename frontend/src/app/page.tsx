'use client';

import { useState, useEffect } from 'react';

interface HealthCheckResponse {
  status: string;
  message: string;
}

export default function Home() {
  const [healthData, setHealthData] = useState<HealthCheckResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHealthCheck = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Get the backend URL from environment variable or default to localhost
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
        
        const response = await fetch(`${backendUrl}/`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data: HealthCheckResponse = await response.json();
        setHealthData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchHealthCheck();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-900 dark:text-white">
          AI Writing Assistant
        </h1>
        
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
            Backend Connection Status
          </h2>
          
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600 dark:text-gray-400">Loading...</span>
            </div>
          )}
          
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
              <div className="flex">
                <div className="text-red-800 dark:text-red-200">
                  <strong>Error:</strong> {error}
                </div>
              </div>
            </div>
          )}
          
          {healthData && !error && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4">
              <div className="space-y-2">
                <div className="text-green-800 dark:text-green-200">
                  <strong>Status:</strong> {healthData.status}
                </div>
                <div className="text-green-700 dark:text-green-300">
                  <strong>Message:</strong> {healthData.message}
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Milestone 1: Frontend ↔ Backend Communication Test
        </div>
      </div>
    </div>
  );
}
