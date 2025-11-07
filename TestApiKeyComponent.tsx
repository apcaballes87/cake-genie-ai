import React from 'react';
import { GEMINI_API_KEY } from './config';

const TestApiKeyComponent: React.FC = () => {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, background: 'red', color: 'white', padding: '10px', zIndex: 9999 }}>
      <p>GEMINI_API_KEY from config: {GEMINI_API_KEY}</p>
      <p>VITE_GEMINI_API_KEY in env: {import.meta.env?.VITE_GEMINI_API_KEY ? 'YES' : 'NO'}</p>
      <p>VITE_GEMINI_API_KEY value: {import.meta.env?.VITE_GEMINI_API_KEY}</p>
    </div>
  );
};

export default TestApiKeyComponent;