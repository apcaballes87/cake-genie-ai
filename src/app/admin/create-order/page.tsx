import CreateOrderClient from './CreateOrderClient';

export const metadata = {
    title: 'Create Order | Genie.ph Admin',
    description:
        'Generate a shareable cart link for a cake design. When a customer opens the link, their existing cart is replaced with the pre-configured design and pre-filled delivery details.',
};

export default function CreateOrderAdminPage() {
    return (
        <div className="min-h-screen bg-gray-50 py-10">
            <CreateOrderClient />
        </div>
    );
}
