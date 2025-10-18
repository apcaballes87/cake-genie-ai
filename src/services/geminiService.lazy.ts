// Lazy load the heavy Gemini service
export const loadGeminiService = async () => {
  const module = await import('./geminiService');
  return module;
};

// Export wrapper functions that lazy load
export const editCakeImage = async (...args: Parameters<typeof import('./geminiService').editCakeImage>) => {
  const { editCakeImage: fn } = await loadGeminiService();
  return fn(...args);
};

export const analyzeCakeImage = async (...args: Parameters<typeof import('./geminiService').analyzeCakeImage>) => {
  const { analyzeCakeImage: fn } = await loadGeminiService();
  return fn(...args);
};

export const fileToBase64 = async (...args: Parameters<typeof import('./geminiService').fileToBase64>) => {
  const { fileToBase64: fn } = await loadGeminiService();
  return fn(...args);
};
