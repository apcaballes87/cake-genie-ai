import { bench, run } from 'mitata';

// Mock Supabase client
const mockInsert = async (data: any) => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 5));
    if (Array.isArray(data)) {
        return { data, error: null };
    }
    return { data: [data], error: null };
};

// Simulate N+1 approach
const addToCart = async (item: any) => {
    return mockInsert(item);
};

// Simulate Batch approach
const addManyToCart = async (items: any[]) => {
    return mockInsert(items);
};

const generateItems = (count: number) => {
    return Array.from({ length: count }, (_, i) => ({
        cake_type: 'round',
        quantity: i,
        user_id: 'user-123'
    }));
};

const items10 = generateItems(10);
const items50 = generateItems(50);

bench('N+1 Insert (10 items)', async () => {
    const promises = items10.map(item => addToCart(item).catch(() => null));
    await Promise.all(promises);
});

bench('Batch Insert (10 items)', async () => {
    await addManyToCart(items10);
});

bench('N+1 Insert (50 items)', async () => {
    const promises = items50.map(item => addToCart(item).catch(() => null));
    await Promise.all(promises);
});

bench('Batch Insert (50 items)', async () => {
    await addManyToCart(items50);
});

run();
