import { Metadata } from 'next';
import PrivacyClient from './PrivacyClient';

export const metadata: Metadata = {
    title: 'Privacy Policy | Genie.ph',
    description: 'Learn how Genie.ph collects, uses, and protects your personal information when you use our AI-powered cake marketplace.',
};

export default function PrivacyPage() {
    return <PrivacyClient />;
}
