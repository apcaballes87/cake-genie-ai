import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { CartProvider } from './contexts/CartContext';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { GoogleMapsLoaderProvider } from './contexts/GoogleMapsLoaderContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <GoogleMapsLoaderProvider>
        <CartProvider>
            <App />
        </CartProvider>
      </GoogleMapsLoaderProvider>
    </QueryClientProvider>
  </React.StrictMode>
);