// EnvVarTest.tsx - Component to verify environment variables
import React from 'react';

const EnvVarTest: React.FC = () => {
  // These will be available at build time
  const envVars = {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET',
    VITE_GEMINI_API_KEY: import.meta.env.VITE_GEMINI_API_KEY ? 'SET' : 'NOT SET',
    VITE_GOOGLE_MAPS_API_KEY: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? 'SET' : 'NOT SET',
    VITE_GOOGLE_CSE_ID: import.meta.env.VITE_GOOGLE_CSE_ID ? 'SET' : 'NOT SET',
  };

  return (
    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <h2 className="text-xl font-bold mb-4">Environment Variables Check</h2>
      <div className="space-y-2">
        {Object.entries(envVars).map(([key, value]) => (
          <div key={key} className="flex justify-between items-center">
            <span className="font-mono text-sm">{key}:</span>
            <span className={`font-mono text-sm px-2 py-1 rounded ${value !== 'NOT SET' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {typeof value === 'string' && value.length > 50 ? `${value.substring(0, 50)}...` : String(value)}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-gray-600">
        Note: For security reasons, sensitive values are masked in the display above.
      </p>
    </div>
  );
};

export default EnvVarTest;