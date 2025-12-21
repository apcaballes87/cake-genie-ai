import { Metadata } from 'next';
import SavedClient from './SavedClient';

export const metadata: Metadata = {
    title: 'My Saved Cakes',
    description: 'View your saved cake designs and favorite products.',
};

export default function SavedPage() {
    return <SavedClient />;
}
