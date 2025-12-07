'use client';
import React from 'react';

const DetailItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="flex justify-between items-start text-xs">
        <span className="text-slate-500 shrink-0 pr-2">{label}:</span>
        <span className="text-slate-700 font-medium text-right">{value}</span>
    </div>
);

export default DetailItem;
