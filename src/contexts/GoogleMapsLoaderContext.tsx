'use client'

import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { useJsApiLoader, Libraries } from '@react-google-maps/api';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!; // Loaded from .env.local

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
        version: 'weekly',
    });

    const [timedOut, setTimedOut] = useState(false);

    useEffect(() => {
        if (isLoaded || loadError) return;
        const timer = setTimeout(() => setTimedOut(true), 10000);
        return () => clearTimeout(timer);
    }, [isLoaded, loadError]);

    const effectiveError = loadError || (timedOut ? new Error('Google Maps took too long to load. Please check your connection.') : undefined);
    const value = { isLoaded, loadError: effectiveError };

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
