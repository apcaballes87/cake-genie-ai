'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/contexts/AuthContext'
import { ImageProvider } from '@/contexts/ImageContext'
import { CustomizationProvider } from '@/contexts/CustomizationContext'
import { CartProvider } from '@/contexts/CartContext'
import { SavedItemsProvider } from '@/contexts/SavedItemsContext'
import { GoogleMapsLoaderProvider } from '@/contexts/GoogleMapsLoaderContext'

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 5 * 60 * 1000, // 5 minutes - data considered fresh
                        gcTime: 10 * 60 * 1000, // 10 minutes - keep unused data in cache
                        retry: 1, // Retry failed requests once
                        refetchOnWindowFocus: false, // Don't refetch when user switches tabs
                        refetchOnReconnect: true, // Refetch when internet reconnects
                    },
                    mutations: {
                        retry: 0, // Don't retry mutations by default
                    },
                },
            })
    )

    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <ImageProvider>
                    <CustomizationProvider>
                        <CartProvider>
                            <SavedItemsProvider>
                                <GoogleMapsLoaderProvider>
                                    {children}
                                    <Toaster
                                        position="bottom-center"
                                        toastOptions={{
                                            style: {
                                                borderRadius: '9999px',
                                                background: '#333',
                                                color: '#fff',
                                                boxShadow: '0 3px 10px rgba(0, 0, 0, 0.2)',
                                            },
                                        }}
                                    />
                                </GoogleMapsLoaderProvider>
                            </SavedItemsProvider>
                        </CartProvider>
                    </CustomizationProvider>
                </ImageProvider>
            </AuthProvider>
        </QueryClientProvider>
    )
}

