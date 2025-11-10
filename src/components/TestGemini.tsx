// Test component to verify Gemini API integration
import React, { useState } from 'react';
import { testGeminiAPI } from '../services/geminiService.simple';

const TestGemini: React.FC = () => {
  const [response, setResponse] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleTestAPI = async () => {
    setLoading(true);
    setError('');
    setResponse('');
    
    try {
      const result = await testGeminiAPI();
      setResponse(result);
    } catch (err: any) {
      // More detailed error handling
      let errorMessage = 'An unknown error occurred';
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (err && typeof err === 'object' && 'message' in err) {
        errorMessage = err.message as string;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      
      // Check if it's a response object with status
      if (err && typeof err === 'object' && 'status' in err) {
        errorMessage = `HTTP ${err.status}: ${errorMessage}`;
      }
      
      setError(errorMessage);
      console.error("Full error object:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Gemini API Test</h1>
      <button
        onClick={handleTestAPI}
        disabled={loading}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
      >
        {loading ? 'Testing...' : 'Test Gemini API'}
      </button>
      
      {error && (
        <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">
          <h2 className="font-bold">Error:</h2>
          <pre className="whitespace-pre-wrap">{error}</pre>
        </div>
      )}
      
      {response && (
        <div className="mt-4 p-4 bg-green-100 text-green-700 rounded">
          <h2 className="font-bold">Response:</h2>
          <pre className="whitespace-pre-wrap">{response}</pre>
        </div>
      )}
    </div>
  );
};

export default TestGemini;