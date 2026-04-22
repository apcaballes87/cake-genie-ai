import { CartSkeleton } from '@/components/LoadingSkeletons';

export default function Loading() {
    return (
        <div className="max-w-7xl mx-auto px-4 py-8 genie-page-bg min-h-screen">
            <h1 className="text-2xl font-bold mb-6 bg-linear-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text">Shopping Cart</h1>
            <CartSkeleton />
        </div>
    );
}
