import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './src/App';
import { CartProvider } from './src/contexts/CartContext';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './src/lib/queryClient';
import { GoogleMapsLoaderProvider } from './src/contexts/GoogleMapsLoaderContext';
import './src/index.css';

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
