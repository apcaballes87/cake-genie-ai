import { useState, useEffect } from 'react';

/**
 * A custom hook to determine if a component has mounted on the client side.
 * This is useful for handling hydration mismatches in Next.js.
 *
 * @returns {boolean} True if the component has mounted on the client side.
 */
export function useHasMounted() {
    const [hasMounted, setHasMounted] = useState(false);

    useEffect(() => {
        setHasMounted(true);
    }, []);

    return hasMounted;
}
