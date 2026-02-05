import React from 'react';

interface ComposeProvidersProps {
    components: Array<React.ComponentType<any> | [React.ComponentType<any>, any]>;
    children: React.ReactNode;
}

export default function ComposeProviders({ components, children }: ComposeProvidersProps) {
    return (
        <>
            {components.reduceRight((acc, Component) => {
                if (Array.isArray(Component)) {
                    const [Provider, props] = Component;
                    return <Provider {...props}>{acc}</Provider>;
                }
                const Provider = Component;
                return <Provider>{acc}</Provider>;
            }, children)}
        </>
    );
}
