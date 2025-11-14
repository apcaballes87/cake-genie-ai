// Lazy load the heavy Gemini service
import type * as GeminiService from './geminiService';

export const loadGeminiService = async (): Promise<typeof GeminiService> => {
  const module = await import('./geminiService');
  return module;
};

// Export wrapper functions that lazy load
export const editCakeImage = async (...args: Parameters<typeof GeminiService.editCakeImage>) => {
  const { editCakeImage: fn } = await loadGeminiService();
  return fn(...args);
};

export const analyzeCakeImage = async (...args: Parameters<typeof GeminiService.analyzeCakeImage>) => {
  const { analyzeCakeImage: fn } = await loadGeminiService();
  return fn(...args);
};

export const validateCakeImage = async (...args: Parameters<typeof GeminiService.validateCakeImage>) => {
  const { validateCakeImage: fn } = await loadGeminiService();
  return fn(...args);
};

export const fileToBase64 = async (...args: Parameters<typeof GeminiService.fileToBase64>) => {
  const { fileToBase64: fn } = await loadGeminiService();
  return fn(...args);
};

export const generateShareableTexts = async (...args: Parameters<typeof GeminiService.generateShareableTexts>) => {
  const { generateShareableTexts: fn } = await loadGeminiService();
  return fn(...args);
};

export const analyzeCakeFeaturesOnly = async (...args: Parameters<typeof GeminiService.analyzeCakeFeaturesOnly>) => {
  const { analyzeCakeFeaturesOnly: fn } = await loadGeminiService();
  return fn(...args);
};

export const enrichAnalysisWithCoordinates = async (...args: Parameters<typeof GeminiService.enrichAnalysisWithCoordinates>) => {
  const { enrichAnalysisWithCoordinates: fn } = await loadGeminiService();
  return fn(...args);
};