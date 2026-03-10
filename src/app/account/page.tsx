import AccountClient from './AccountClient';
import { buildNoIndexPageMetadata } from '@/lib/utils/metadata';

export const metadata = buildNoIndexPageMetadata({
    title: 'My Account',
    description: 'Manage your profile, view orders, and save your favorite cake designs.',
});

export default function AccountPage() {
    return <AccountClient />;
}
