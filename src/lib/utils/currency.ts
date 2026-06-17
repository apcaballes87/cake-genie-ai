export const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};

export const formatStartingPrice = (price?: number | null, cakeType?: string | null): string => {
    const amount = price || 1599;
    const formatted = new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);

    if (!cakeType || !cakeType.trim()) {
        return `Starts at ${formatted}`;
    }

    const cleanType = cakeType.trim();
    return `${cleanType} starts at ${formatted}`;
};
