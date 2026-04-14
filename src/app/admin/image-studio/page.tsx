import ImageStudioAdminClient from './ImageStudioAdminClient';

export const metadata = {
  title: 'Image Studio | Genie.ph Admin',
  description:
    'Review cake cache images, generate pastel purple cyclorama edits, and persist edited outputs.',
};

export default function ImageStudioAdminPage() {
  return (
    <div className="min-h-screen bg-linear-to-br from-fuchsia-50 via-white to-violet-100 py-10">
      <ImageStudioAdminClient />
    </div>
  );
}
