import SavedClient from './SavedClient';
import { buildNoIndexPageMetadata } from '@/lib/utils/metadata';

export const metadata = buildNoIndexPageMetadata({
    title: 'My Saved Cakes',
    description: 'View your saved cake designs and favorite products.',
});

export default function SavedPage() {
    return <SavedClient />;
}
