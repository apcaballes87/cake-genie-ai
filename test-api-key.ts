// Test file to check if API key is loaded correctly
import { GEMINI_API_KEY } from './config';

console.log('GEMINI_API_KEY from config:', GEMINI_API_KEY);
console.log('Is VITE_GEMINI_API_KEY in env?:', !!import.meta.env?.VITE_GEMINI_API_KEY);
console.log('VITE_GEMINI_API_KEY value:', import.meta.env?.VITE_GEMINI_API_KEY);