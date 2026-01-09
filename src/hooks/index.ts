// hooks/index.ts
export { useImageManagement } from './useImageManagement';
export { useCakeCustomization } from './useCakeCustomization';
export { useSearchEngine } from './useSearchEngine';
export { usePricing } from './usePricing';
export { useDesignSharing } from './useDesignSharing';
export { useAppNavigation, type AppState } from './useAppNavigation';
export { useDesignUpdate } from './useDesignUpdate';
// Re-export useAuth from AuthContext (single source of truth)
export { useAuth } from '@/contexts/AuthContext';
export { useAddresses } from './useAddresses';
export { useOrders } from './useOrders';
export { useAvailabilitySettings } from './useAvailabilitySettings';
export { useCanonicalUrl } from './useCanonicalUrl';

export { useSEO, generateCakeStructuredData } from './useSEO';
