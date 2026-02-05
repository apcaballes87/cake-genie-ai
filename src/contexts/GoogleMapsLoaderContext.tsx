'use client'

import React, { createContext, useContext, ReactNode } from 'react';
import { useJsApiLoader, Libraries } from '@react-google-maps/api';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;

const LIBRARIES: Libraries = ['places', 'geocoding'];

interface GoogleMapsLoaderContextType {
    isLoaded: boolean;
    loadError: Error | undefined;
}

const GoogleMapsLoaderContext = createContext<GoogleMapsLoaderContextType | undefined>(undefined);

export const GoogleMapsLoaderProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { isLoaded, loadError } = useJsApiLoader({
        id: 'google-map-script', // Use a single, consistent ID for the whole app
        googleMapsApiKey: GOOGLE_MAPS_API_KEY,
        libraries: LIBRARIES,
    });

    const value = { isLoaded, loadError };

    return (
        <GoogleMapsLoaderContext.Provider value={value}>
            {children}
        </GoogleMapsLoaderContext.Provider>
    );
};

export const useGoogleMapsLoader = (): GoogleMapsLoaderContextType => {
    const context = useContext(GoogleMapsLoaderContext);
    // Return a safe default if not wrapped in provider
    // This allows components to lazily load the provider when needed
    return context ?? { isLoaded: false, loadError: undefined };
};
