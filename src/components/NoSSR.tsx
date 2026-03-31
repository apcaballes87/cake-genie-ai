import dynamic from 'next/dynamic';
import React from 'react';

/**
 * A wrapper component that only renders its children on the client side.
 * This is useful for handling hydration mismatches in Next.js for client-only components.
 */
const NoSSRWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <React.Fragment>{children}</React.Fragment>
);

export const NoSSR = dynamic(() => Promise.resolve(NoSSRWrapper), {
  ssr: false,
});

export default NoSSR;
