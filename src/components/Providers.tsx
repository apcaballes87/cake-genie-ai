'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/contexts/AuthContext'
import { ImageProvider } from '@/contexts/ImageContext'
import { CustomizationProvider } from '@/contexts/CustomizationContext'
import { CartProvider } from '@/contexts/CartContext'
import { GoogleMapsLoaderProvider } from '@/contexts/GoogleMapsLoaderContext'

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 60 * 1000,
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
                        </CartProvider>
                    </CustomizationProvider>
                </ImageProvider>
            </AuthProvider>
        </QueryClientProvider>
    )
}
