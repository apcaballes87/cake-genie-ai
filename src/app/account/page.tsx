import AccountClient from './AccountClient';

import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'My Account | Genie.ph',
    description: 'Manage your profile, view orders, and save your favorite cake designs.',
};

export default function AccountPage() {
    return <AccountClient />;
}
