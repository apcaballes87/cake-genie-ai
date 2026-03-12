import DataDeletionClient from './DataDeletionClient';
import { buildMarketingPageMetadata } from '@/lib/utils/metadata';

export const metadata = buildMarketingPageMetadata({
    title: 'Data Deletion Instructions',
    description: 'Learn how to request the deletion of your Genie.ph account and personal data in compliance with data privacy regulations.',
    canonicalPath: 'https://genie.ph/privacy/data-deletion',
});

export default function DataDeletionPage() {
    return <DataDeletionClient />;
}
