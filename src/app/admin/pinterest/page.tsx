// src/app/admin/pinterest/page.tsx
import PinterestManagerClient from './PinterestManagerClient';

export const metadata = {
  title: 'Pinterest Manager | Genie.ph Admin',
  description: 'Manage Pinterest Channel integration and product sync.',
};

export default function PinterestAdminPage() {
  return (
    <div className="min-h-screen bg-linear-to-br from-indigo-50 to-pink-50 py-12">
      <PinterestManagerClient />
    </div>
  );
}
