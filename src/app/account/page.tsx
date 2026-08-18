import AccountClient from './AccountClient';
import { buildNoIndexPageMetadata } from '@/lib/utils/metadata';

export const metadata = buildNoIndexPageMetadata({
    title: 'My Account',
    description: 'Manage your profile, view orders, saved cake designs, and party budget.',
});

export default function AccountPage() {
    return <AccountClient />;
}
