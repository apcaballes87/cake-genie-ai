import { Metadata } from 'next';
import SavedClient from './SavedClient';

export const metadata: Metadata = {
    title: 'My Saved Cakes',
    description: 'View your saved cake designs and favorite products.',
    robots: {
        index: false,
        follow: false,
    },
};

export default function SavedPage() {
    return <SavedClient />;
}
