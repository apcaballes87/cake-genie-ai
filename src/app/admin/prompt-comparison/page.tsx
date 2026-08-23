import PromptComparisonClient from './PromptComparisonClient';

export const metadata = {
    title: 'Prompt Comparison | Genie.ph Admin',
    description:
        'Compare AI cake analysis results across different prompt versions for the same image.',
};

export default function PromptComparisonAdminPage() {
    return (
        <div className="min-h-screen bg-gray-50 py-10">
            <PromptComparisonClient />
        </div>
    );
}
