import { CartSkeleton } from '@/components/LoadingSkeletons';

export default function Loading() {
    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold mb-6">Shopping Cart</h1>
            <CartSkeleton />
        </div>
    );
}
