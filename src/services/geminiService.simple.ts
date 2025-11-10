// Simple test file to understand Google Generative AI library usage
import { GoogleGenerativeAI } from "@google/generative-ai";

// Get the API key from environment variables
const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;

console.log("API Key present:", !!geminiApiKey);
console.log("API Key length:", geminiApiKey ? geminiApiKey.length : 0);

if (!geminiApiKey) {
    throw new Error("VITE_GEMINI_API_KEY environment variable not set");
}

if (geminiApiKey.length < 10) {
    throw new Error("VITE_GEMINI_API_KEY appears to be invalid (too short)");
}

// Initialize the Google Generative AI client
const genAI = new GoogleGenerativeAI(geminiApiKey);

// List of models to try - using the latest stable models
const MODELS_TO_TRY = [
    "gemini-2.5-flash",  // Latest Flash model
    "gemini-2.5-pro",    // Latest Pro model
    "gemini-1.5-flash-002", // Previous generation stable model
    "gemini-1.5-pro-002"    // Previous generation stable model
];

// Function to test the API with multiple models
export async function testGeminiAPI() {
    const errors: string[] = [];
    
    for (const modelName of MODELS_TO_TRY) {
        try {
            console.log(`Trying model: ${modelName}`);
            const model = genAI.getGenerativeModel({ model: modelName });
            
            const prompt = "Write a short poem about cakes";
            
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            console.log(`Success with model: ${modelName}`);
            return `Model: ${modelName}\n\n${text}`;
        } catch (error: any) {
            const errorMessage = error.message || error.toString();
            console.log(`Failed with model ${modelName}: ${errorMessage}`);
            errors.push(`Model ${modelName}: ${errorMessage}`);
        }
    }
    
    // If all models failed, throw an error with all the details
    throw new Error(`All models failed:\n${errors.join('\n')}`);
}