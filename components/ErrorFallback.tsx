import React from 'react';
import { ErrorIcon } from './icons';

interface ErrorFallbackProps {
  error?: Error;
  resetError?: () => void;
  title?: string;
  message?: string;
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({ 
  error, 
  resetError,
  title = 'Something went wrong',
  message = 'We encountered an unexpected error. Please try again.'
}) => {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
        <ErrorIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
        <p className="text-gray-600 mb-4">{message}</p>
        
        {error && (
          <details className="text-left bg-gray-50 rounded p-3 mb-4">
            <summary className="cursor-pointer text-sm font-medium text-gray-700">
              Error Details
            </summary>
            <pre className="text-xs text-red-600 mt-2 overflow-auto">
              {error.message}
            </pre>
          </details>
        )}
        
        {resetError && (
          <button
            onClick={resetError}
            className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-2 rounded-full font-semibold hover:shadow-lg transition-all"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
};