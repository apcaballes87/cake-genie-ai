import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { calculatePriceFromDatabase } from '../../services/pricingService.database';
import type { MainTopperUI, SupportElementUI, AddOnPricing, CakeInfoUI, IcingDesignUI, CakeType } from '../../types';
import { ArrowLeft, Trash2, Loader2, FlaskConical } from 'lucide-react';
import { CAKE_TYPES, DEFAULT_SIZE_MAP, DEFAULT_THICKNESS_MAP } from '../../constants';
import { showError } from '../../lib/utils/toast';

interface PricingSandboxPageProps {
  onClose: () => void;
}

const testItemsToAdd = [
    { label: "Add 'icing_doodle' (Topper, M)", category: 'main_topper', type: 'icing_doodle', size: 'medium', description: 'Icing Doodle (Topper)' },
    { label: "Add 'icing_doodle' (Support, M)", category: 'support_element', type: 'icing_doodle', coverage: 'medium', description: 'Icing Doodle (Support)' },
    { label: "Add 'toy' (Topper, S)", category: 'main_topper', type: 'toy', size: 'small', description: 'Toy (Small)' },
    { label: "Add 'toy' (Topper, M)", category: 'main_topper', type: 'toy', size: 'medium', description: 'Toy (Medium)' },
    { label: "Add 'toy' (Topper, L)", category: 'main_topper', type: 'toy', size: 'large', description: 'Toy (Large)' },
    { label: "Add 'candle' (Topper, 2 digits)", category: 'main_topper', type: 'candle', size: 'small', description: 'Candle "25"', quantity: 1 },
    { label: "Add 'sprinkles' (Support, L)", category: 'support_element', type: 'sprinkles', coverage: 'large', description: 'Sprinkles (Large)' },
];

const PricingSandboxPage: React.FC<PricingSandboxPageProps> = ({ onClose }) => {
    const [mainToppers, setMainToppers] = useState<MainTopperUI[]>([]);
    const [supportElements, setSupportElements] = useState<SupportElementUI[]>([]);
    const [icingDesign, setIcingDesign] = useState<IcingDesignUI>({
        base: 'soft_icing', color_type: 'single', colors: {}, border_top: false, border_base: false, drip: false, gumpasteBaseBoard: false, dripPrice: 0, gumpasteBaseBoardPrice: 0
    });
    const [cakeType, setCakeType] = useState<CakeType>('1 Tier');

    const [pricingResult, setPricingResult] = useState<{ addOnPricing: AddOnPricing; itemPrices: Map<string, number> } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    
    const cakeInfo: CakeInfoUI = useMemo(() => ({
        type: cakeType,
        size: DEFAULT_SIZE_MAP[cakeType],
        thickness: DEFAULT_THICKNESS_MAP[cakeType],
        flavors: ['Chocolate Cake']
    }), [cakeType]);

    const runCalculation = useCallback(async () => {
        console.clear();
        setIsLoading(true);
        try {
            const result = await calculatePriceFromDatabase({ mainToppers, supportElements, cakeMessages: [], icingDesign, cakeInfo });
            setPricingResult(result);
        } catch (e) {
            const error = e as Error;
            showError(`Calculation failed: ${error.message}`);
            console.error("❌ Calculation failed:", error);
        } finally {
            setIsLoading(false);
        }
    }, [mainToppers, supportElements, icingDesign, cakeInfo]);

    useEffect(() => {
        runCalculation();
    }, [runCalculation]);

    const addTestItem = (itemConfig: any) => {
        const id = crypto.randomUUID();
        if (itemConfig.category === 'main_topper') {
            const newTopper: MainTopperUI = {
                id,
                type: itemConfig.type,
                description: itemConfig.description,
                size: itemConfig.size || 'medium',
                quantity: itemConfig.quantity || 1,
                isEnabled: true,
                price: 0, // will be calculated
                group_id: id,
                classification: 'hero',
                original_type: itemConfig.type,
            };
            setMainToppers(prev => [...prev, newTopper]);
        } else if (itemConfig.category === 'support_element') {
            const newElement: SupportElementUI = {
                id,
                type: itemConfig.type,
                description: itemConfig.description,
                coverage: itemConfig.coverage || 'medium',
                isEnabled: true,
                price: 0, // will be calculated
                group_id: id,
                original_type: itemConfig.type,
            };
            setSupportElements(prev => [...prev, newElement]);
        }
    };

    const removeItem = (id: string, category: 'main_topper' | 'support_element') => {
        if (category === 'main_topper') {
            setMainToppers(prev => prev.filter(item => item.id !== id));
        } else {
            setSupportElements(prev => prev.filter(item => item.id !== id));
        }
    };
    
    const toggleIcingFeature = (feature: 'drip' | 'gumpasteBaseBoard') => {
        setIcingDesign(prev => ({...prev, [feature]: !prev[feature]}));
    };

    const reset = () => {
        setMainToppers([]);
        setSupportElements([]);
        setIcingDesign(prev => ({...prev, drip: false, gumpasteBaseBoard: false}));
        setCakeType('1 Tier');
        setPricingResult(null);
    };

    const allItems = useMemo(() => [
        ...mainToppers.map(item => ({ ...item, category: 'main_topper' as const })),
        ...supportElements.map(item => ({ ...item, category: 'support_element' as const }))
    ], [mainToppers, supportElements]);

    return (
        <div className="w-full max-w-6xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Go back">
                    <ArrowLeft />
                </button>
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text flex items-center gap-2">
                        <FlaskConical size={28} /> Pricing Sandbox
                    </h1>
                    <p className="text-sm text-slate-500">Test and verify the database-driven pricing engine.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column: Controls & Current Items */}
                <div className="space-y-6">
                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                        <h2 className="text-lg font-bold text-slate-800 mb-3">Test Case Controls</h2>
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            {testItemsToAdd.map(item => (
                                <button key={item.label} onClick={() => addTestItem(item)} className="text-xs text-left p-2 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors">{item.label}</button>
                            ))}
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-4">
                             <button onClick={() => toggleIcingFeature('drip')} className={`text-xs p-2 rounded-md transition-colors ${icingDesign.drip ? 'bg-pink-100 text-pink-800' : 'bg-slate-100 hover:bg-slate-200'}`}>Toggle Drip</button>
                             <button onClick={() => toggleIcingFeature('gumpasteBaseBoard')} className={`text-xs p-2 rounded-md transition-colors ${icingDesign.gumpasteBaseBoard ? 'bg-pink-100 text-pink-800' : 'bg-slate-100 hover:bg-slate-200'}`}>Toggle Base Board</button>
                        </div>
                        <div className="flex items-center gap-4">
                            <label htmlFor="cakeType" className="text-sm font-medium text-slate-600">Cake Type:</label>
                            <select id="cakeType" value={cakeType} onChange={e => setCakeType(e.target.value as CakeType)} className="flex-grow p-2 text-sm border-slate-300 rounded-md shadow-sm focus:ring-pink-500 focus:border-pink-500">
                                {CAKE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                            </select>
                        </div>
                        <button onClick={reset} className="mt-4 w-full text-sm font-semibold text-red-600 hover:bg-red-50 p-2 rounded-md transition-colors">Reset All</button>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                        <h2 className="text-lg font-bold text-slate-800 mb-3">Current Items in Calculation</h2>
                        {allItems.length === 0 ? <p className="text-sm text-slate-500 text-center py-4">Add items to begin.</p> : (
                            <ul className="space-y-2">
                                {allItems.map(item => (
                                    <li key={item.id} className="flex justify-between items-center p-2 bg-slate-50 rounded-md">
                                        <span className="text-sm text-slate-700">{item.description}</span>
                                        <button onClick={() => removeItem(item.id, item.category)} className="p-1 text-slate-400 hover:text-red-500 rounded-full hover:bg-red-100 transition-colors"><Trash2 size={16} /></button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* Right Column: Results */}
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                     <h2 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                        Pricing Calculation Results
                        {isLoading && <Loader2 size={16} className="animate-spin text-slate-400" />}
                    </h2>
                    {pricingResult ? (
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-600 mb-2">Price Breakdown</h3>
                                <table className="w-full table-auto">
                                    <thead className="text-left bg-slate-50">
                                        <tr>
                                            <th className="py-2 px-3 text-xs font-semibold text-slate-500">Item</th>
                                            <th className="py-2 px-3 text-xs font-semibold text-slate-500 text-right">Price</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pricingResult.addOnPricing.breakdown.map((row, i) => (
                                            <tr key={i} className="border-b border-slate-100">
                                                <td className={`py-2 px-3 text-sm ${row.price < 0 ? 'text-green-600' : 'text-slate-700'}`}>{row.item}</td>
                                                <td className={`py-2 px-3 text-sm font-mono text-right ${row.price < 0 ? 'text-green-600' : 'text-slate-700'}`}>{row.price.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t-2 border-slate-300 font-bold">
                                            <td className="py-3 px-3 text-slate-800">Total Add-on Price</td>
                                            <td className="py-3 px-3 text-pink-600 text-right text-lg font-mono">₱{pricingResult.addOnPricing.addOnPrice.toFixed(2)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                             <div>
                                <h3 className="text-sm font-semibold text-slate-600 mb-2">Item Prices Map (Raw)</h3>
                                <pre className="text-xs bg-slate-800 text-white p-3 rounded-md overflow-x-auto">
                                    {JSON.stringify(Object.fromEntries(pricingResult.itemPrices), null, 2)}
                                </pre>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-16 text-slate-500">
                            <p>Results will appear here.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PricingSandboxPage;
