'use client';

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  Download,
  FileText,
  Save,
  Loader2,
  Plus,
  Trash2,
  AlertCircle,
  Building2,
  UtensilsCrossed,
  Cake,
  PartyPopper,
  Sparkles,
  Camera,
  Gift,
  Package,
  Gamepad2,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { showError, showSuccess } from '@/lib/utils/toast';
import PartyBudgetSignupModal from '@/components/PartyBudgetSignupModal';
import { getPartyBudget, savePartyBudget } from '@/services/partyBudgetService';
import {
  PARTY_BUDGET_ITEMS_STORAGE_KEY,
  PARTY_BUDGET_META_STORAGE_KEY,
  PENDING_PARTY_BUDGET_SAVE_KEY,
  isPartyBudgetSnapshot,
  type PartyBudgetItem as BudgetItem,
  type PartyBudgetSnapshot,
} from '@/lib/partyBudget';

type Category = {
  id: string;
  label: string;
  description: string;
};

const exchangeRates: Record<string, number> = {
  PHP: 1,
  USD: 0.018,
  EUR: 0.0166,
  GBP: 0.0145,
};

const symbolMap: Record<string, string> = {
  PHP: '₱',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

const breakdownPalette = [
  '#7c3aed',
  '#db2777',
  '#ea580c',
  '#16a34a',
  '#2563eb',
  '#ca8a04',
  '#dc2626',
  '#0891b2',
  '#9333ea',
];

const categoryIcons: Record<string, LucideIcon> = {
  venue: Building2,
  food: UtensilsCrossed,
  cake: Cake,
  entertainment: PartyPopper,
  decorations: Sparkles,
  photo: Camera,
  favors: Gift,
  supplies: Package,
  activities: Gamepad2,
};

const formatCurrency = (amount: number, curr: string): string => {
  const rate = exchangeRates[curr] ?? 1;
  const converted = amount * rate;
  const symbol = symbolMap[curr] ?? '';
  if (curr === 'PHP') {
    return `${symbol}${converted.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  }
  return (
    symbol +
    converted.toLocaleString('en-US', {
      style: 'currency',
      currency: curr,
      maximumFractionDigits: 0,
    })
  );
};

const initialCategories: Category[] = [
  { id: 'venue', label: 'Venue & Setup', description: 'Party venue rental, tables, chairs, balloon setup' },
  { id: 'food', label: 'Food & Catering', description: 'Kids meal sets, adult meals, snacks, drinks' },
  { id: 'cake', label: 'Cakes & Desserts', description: 'Themed birthday cake, dessert table, cupcakes' },
  { id: 'entertainment', label: 'Entertainment', description: 'Clown, magician, character mascot, DJ or sound' },
  { id: 'decorations', label: 'Party Decorations', description: 'Balloons, backdrop, banners, thematic supplies' },
  { id: 'photo', label: 'Photography & Video', description: 'Kid-focused photographer, video coverage' },
  { id: 'favors', label: 'Party Favors', description: 'Loot bags, toys, giveaways for children' },
  { id: 'supplies', label: 'Party Supplies', description: 'Plates, cups, utensils, serving ware, signage' },
  { id: 'activities', label: 'Games & Activities', description: 'Inflatables, face painting, arts & crafts' },
];

const initialLineItems: Record<string, BudgetItem[]> = {
  venue: [
    { id: 'venue-rental', label: 'Venue rental', description: 'Party hall, garden, indoor play area', cost: 25000, qty: 1 },
    { id: 'setup-service', label: 'Setup & cleanup service', description: 'Tables, chairs, balloon setup crew', cost: 5000, qty: 1 },
  ],
  food: [
    { id: 'catering', label: 'Catering (per guest)', description: 'Adult meal sets, buffet portions', cost: 120, perGuest: true },
    { id: 'catering-kids', label: 'Catering / food for kids (per child)', description: 'Kids meal sets, snacks', cost: 100, perChild: true },
  ],
  cake: [
    { id: 'birthday-cake', label: 'Birthday cake', description: 'Tiered themed cake', cost: 5000, qty: 1 },
    { id: 'dessert-table', label: 'Dessert table', description: 'Cupcakes, cookies, candy bar', cost: 3000, qty: 1 },
  ],
  entertainment: [
    { id: 'entertainer', label: 'Entertainer', description: 'Clown, magician, or character mascot', cost: 8000, qty: 1 },
    { id: 'sound', label: 'Sound system / DJ', description: 'Microphone, speaker, playlist', cost: 7000, qty: 1 },
  ],
  decorations: [
    { id: 'balloon-setup', label: 'Balloon setup', description: 'Arch, bouquets, helium balloons', cost: 4000, qty: 1 },
    { id: 'backdrop', label: 'Backdrop & banners', description: 'Photo backdrop, Happy Birthday banner', cost: 3000, qty: 1 },
  ],
  photo: [
    { id: 'photographer', label: 'Photographer', description: '3-hour coverage with digital gallery', cost: 8000, qty: 1 },
    { id: 'videographer', label: 'Videographer', description: 'Same-day edit / highlight clip', cost: 2000, qty: 1 },
  ],
  favors: [
    { id: 'loot-bags', label: 'Loot bags (per child)', description: 'Goodie bags with small toys or treats', cost: 200, perChild: true },
  ],
  supplies: [
    { id: 'disposable-supplies', label: 'Disposable supplies', description: 'Plates, cups, utensils, napkins', cost: 2500, qty: 1 },
  ],
  activities: [
    { id: 'inflatable', label: 'Inflatable / activity rental', description: 'Bouncy castle, slide, or game booth', cost: 3000, qty: 1 },
    { id: 'face-painting', label: 'Face painting / arts & crafts', description: 'Face painter or craft station', cost: 2000, qty: 1 },
  ],
};

const inputClass =
  'mt-1 w-full rounded-lg border border-purple-100 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30';

const labelClass = 'block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500';

export default function PartyBudgetCalculator() {
  const printRef = useRef<HTMLDivElement>(null);
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const [partyDate, setPartyDate] = useState('');
  const [guestCount, setGuestCount] = useState(30);
  const [childCount, setChildCount] = useState(20);
  const [kidsAttending, setKidsAttending] = useState(true);
  const [currency, setCurrency] = useState('PHP');
  const [overallBudget, setOverallBudget] = useState('');
  const [contingency, setContingency] = useState(8);
  const [lineItems, setLineItems] = useState<Record<string, BudgetItem[]>>(initialLineItems);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);
  const cloudSyncUserRef = useRef<string | null>(null);

  const guestCountRef = useRef<HTMLInputElement>(null);
  const childCountRef = useRef<HTMLInputElement>(null);

  const focusGuestCount = () => {
    guestCountRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => guestCountRef.current?.focus(), 400);
  };
  const focusChildCount = () => {
    childCountRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => childCountRef.current?.focus(), 400);
  };

  const globalState = useMemo(
    () => ({ partyDate, guestCount, childCount, kidsAttending, currency, overallBudget, contingency }),
    [partyDate, guestCount, childCount, kidsAttending, currency, overallBudget, contingency]
  );

  const getQty = (item: BudgetItem): number => {
    if (item.perGuest) return guestCount;
    if (item.perChild) return kidsAttending ? childCount : 0;
    return item.qty ?? 1;
  };

  const getLineTotal = (item: BudgetItem): number => item.cost * getQty(item);

  const visibleItems = (items: BudgetItem[]) =>
    items.filter((item) => kidsAttending || !item.perChild);

  const updateItem = (categoryId: string, itemId: string, patch: Partial<BudgetItem>) => {
    setLineItems((prev) => ({
      ...prev,
      [categoryId]: prev[categoryId].map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    }));
  };

  const handleCostChange = (categoryId: string, itemId: string, value: string) => {
    updateItem(categoryId, itemId, { cost: parseFloat(value) || 0 });
  };

  const handleQtyChange = (categoryId: string, itemId: string, value: string) => {
    updateItem(categoryId, itemId, { qty: Math.max(0, parseInt(value) || 0) });
  };

  const handleAddItem = (categoryId: string) => {
    const newItem: BudgetItem = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: '',
      description: '',
      cost: 0,
      qty: 1,
      isCustom: true,
    };
    setLineItems((prev) => ({
      ...prev,
      [categoryId]: [...(prev[categoryId] || []), newItem],
    }));
  };

  const handleRemoveItem = (categoryId: string, itemId: string) => {
    setLineItems((prev) => ({
      ...prev,
      [categoryId]: prev[categoryId].filter((item) => item.id !== itemId),
    }));
  };

  const handleReset = () => {
     setPartyDate('');
    setGuestCount(30);
    setChildCount(20);
    setKidsAttending(true);
    setCurrency('PHP');
    setOverallBudget('');
    setContingency(8);
    setLineItems(initialLineItems);
    localStorage.removeItem(PARTY_BUDGET_ITEMS_STORAGE_KEY);
    localStorage.removeItem(PARTY_BUDGET_META_STORAGE_KEY);
  };

  const subtotal = useMemo(() => {
    let sum = 0;
    Object.values(lineItems).forEach((items) => {
      items.forEach((item) => {
        sum += getLineTotal(item);
      });
    });
    return sum;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineItems, guestCount, childCount, kidsAttending]);

  const contingencyAmount = (subtotal * contingency) / 100;
  const total = subtotal + contingencyAmount;
  const budget = parseFloat(overallBudget) || 0;
  const remaining = budget - total;

  const categoryTotals: Record<string, number> = {};
  initialCategories.forEach((cat) => {
    const items = lineItems[cat.id] || [];
    let catTotal = 0;
    items.forEach((item) => {
      catTotal += getLineTotal(item);
    });
    categoryTotals[cat.id] = catTotal;
  });

  useEffect(() => {
    const savedItems = localStorage.getItem(PARTY_BUDGET_ITEMS_STORAGE_KEY);
    if (savedItems) {
      try {
        const parsed = JSON.parse(savedItems) as Record<string, BudgetItem[]>;
        if (parsed && typeof parsed === 'object' && Object.values(parsed).every(Array.isArray)) {
          Object.values(parsed).forEach((items) => {
            items.forEach((item) => {
              if (item.qty == null) item.qty = 1;
            });
          });
          setLineItems({ ...initialLineItems, ...parsed });
        }
      } catch {
        // ignore parse errors
      }
    }
    const savedMeta = localStorage.getItem(PARTY_BUDGET_META_STORAGE_KEY);
    if (savedMeta) {
      try {
         const parsed = JSON.parse(savedMeta);
        setPartyDate(parsed.partyDate || '');
        setGuestCount(parsed.guestCount || 30);
         setChildCount(parsed.childCount || 0);
        setKidsAttending(parsed.kidsAttending ?? true);
        setCurrency(parsed.currency || 'PHP');
        setOverallBudget(parsed.overallBudget || '');
        setContingency(parsed.contingency ?? 8);
      } catch {
        // ignore parse errors
      }
    }
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    localStorage.setItem(PARTY_BUDGET_ITEMS_STORAGE_KEY, JSON.stringify(lineItems));
  }, [hasHydrated, lineItems]);

  useEffect(() => {
    if (!hasHydrated) return;
    localStorage.setItem(PARTY_BUDGET_META_STORAGE_KEY, JSON.stringify(globalState));
  }, [globalState, hasHydrated]);

  const applySnapshot = useCallback((snapshot: PartyBudgetSnapshot) => {
    const { meta, lineItems: savedLineItems } = snapshot;
    setPartyDate(meta.partyDate || '');
    setGuestCount(meta.guestCount || 30);
    setChildCount(meta.childCount ?? 0);
    setKidsAttending(meta.kidsAttending ?? true);
    setCurrency(meta.currency || 'PHP');
    setOverallBudget(meta.overallBudget || '');
    setContingency(meta.contingency ?? 8);
    setLineItems({ ...initialLineItems, ...savedLineItems });
  }, []);

  const persistPartyBudget = useCallback(async (clearPendingSave: boolean) => {
    if (!user || user.is_anonymous || !isAuthenticated) return false;

    setIsSaving(true);
    try {
      await savePartyBudget(
        user.id,
        { meta: globalState, lineItems },
        {
          partyDate,
          guestCount,
          totalAmount: total,
          budgetAmount: budget > 0 ? budget : null,
          currency,
        }
      );
      if (clearPendingSave) localStorage.removeItem(PENDING_PARTY_BUDGET_SAVE_KEY);
      setIsSignupModalOpen(false);
      showSuccess('Party budget saved to your account.');
      return true;
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Could not save your party budget.');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [budget, currency, globalState, guestCount, isAuthenticated, lineItems, partyDate, total, user]);

  useEffect(() => {
    if (!hasHydrated || isAuthLoading || !isAuthenticated || !user || user.is_anonymous) return;
    if (cloudSyncUserRef.current === user.id) return;
    cloudSyncUserRef.current = user.id;

    const syncAccountBudget = async () => {
      if (localStorage.getItem(PENDING_PARTY_BUDGET_SAVE_KEY)) {
        await persistPartyBudget(true);
        return;
      }

      try {
        const savedBudget = await getPartyBudget(user.id);
        if (savedBudget && isPartyBudgetSnapshot(savedBudget.budget_data)) {
          applySnapshot(savedBudget.budget_data);
        }
      } catch (error) {
        cloudSyncUserRef.current = null;
        showError(error instanceof Error ? error.message : 'Could not load your saved party budget.');
      }
    };

    void syncAccountBudget();
  }, [applySnapshot, hasHydrated, isAuthLoading, isAuthenticated, persistPartyBudget, user]);

  const handleSaveDetails = async () => {
    if (!isAuthenticated || !user || user.is_anonymous) {
      localStorage.setItem(PENDING_PARTY_BUDGET_SAVE_KEY, 'true');
      setIsSignupModalOpen(true);
      return;
    }

    await persistPartyBudget(false);
  };

  const handleExportPDF = () => {
    (async () => {
      const jspdfLib = await import('jspdf');
      const doc = new jspdfLib.jsPDF({ unit: 'pt', format: 'a4' });
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();
      const ML = 50;
      const MR = W - 50;
      let y = 0;

      const ensureSpace = (h: number) => {
        if (y + h > H - 50) {
          doc.addPage();
          y = 70;
        }
      };

      const drawDetailRow = (label: string, value: string, yPos: number) => {
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'normal');
        doc.text(label, ML, yPos);
        doc.setTextColor(17, 24, 40);
        doc.setFont('helvetica', 'bold');
        doc.text(value, MR, yPos, { align: 'right' });
      };

      const fmt = (v: number) => formatCurrency(v, currency);

      // Header band
      doc.setFillColor(184, 126, 254);
      doc.rect(0, 0, W, 62, 'F');
      y = 62;
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('Birthday Party Budget', ML, y + 6);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text('Generated by Genie.ph', MR, y + 6, { align: 'right' });

      // Party details
      doc.setTextColor(17, 24, 40);
      y += 18;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Party details', ML, y);
      const detailRows: Array<[string, string]> = [
        ['Party date', partyDate || '—'],
        ['Total guests', String(guestCount)],
        ['Kids attending', kidsAttending ? String(childCount) : 'No'],
        ['Overall budget', overallBudget ? fmt(budget) : '—'],
        ['Contingency', `${contingency}%`],
      ];
      detailRows.forEach(([label, value]) => {
        y += 15;
        drawDetailRow(label, value, y);
      });

      // Per-category line items
      const colW = [200, 100, 36, 64, 70];
      const startX = ML;
      let cx = startX;
      const colX: number[] = [];
      colW.forEach((w) => {
        colX.push(cx);
        cx += w;
      });
      const tableWidth = cx - startX;
      const rightCols = new Set([2, 3, 4]);

      const heads = ['Item', 'Details', 'Qty', 'Unit price', 'Total'];

      const drawTableHead = () => {
        const rowH = 20;
        const headY = y + 14;
        ensureSpace(rowH + 8);
        doc.setFillColor(241, 245, 249);
        doc.rect(startX, headY, tableWidth, rowH, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.rect(startX, headY, tableWidth, rowH);
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.setFont('helvetica', 'bold');
        heads.forEach((h, i) => {
          doc.text(h, colX[i] + (rightCols.has(i) ? colW[i] - 6 : 6), headY + 13, {
            align: rightCols.has(i) ? 'right' : 'left',
          });
        });
        y = headY + rowH;
      };

      initialCategories.forEach((cat) => {
        const items = visibleItems(lineItems[cat.id] || []);
        if (items.length === 0) return;
        ensureSpace(items.length * 20 + 24);
        y += 8;
        doc.setFontSize(12);
        doc.setTextColor(17, 24, 40);
        doc.setFont('helvetica', 'bold');
        doc.text(cat.label, startX, y);

        drawTableHead();

        const rowH = 20;
        items.forEach((item) => {
          y += rowH;
          doc.setDrawColor(226, 232, 240);
          doc.line(startX, y, startX + tableWidth, y);
          doc.setFontSize(9);
          doc.setTextColor(17, 24, 40);
          doc.setFont('helvetica', 'normal');
          const cells = [item.label, item.vendor ?? '', String(getQty(item)), fmt(item.cost), fmt(getLineTotal(item))];
          cells.forEach((val, i) => {
            doc.text(String(val), colX[i] + (rightCols.has(i) ? colW[i] - 6 : 6), y + 13, {
              align: rightCols.has(i) ? 'right' : 'left',
            });
          });
        });

        doc.setDrawColor(226, 232, 240);
        doc.line(startX, y, startX + tableWidth, y);
        y += 16;
        drawDetailRow(`${cat.label} subtotal`, fmt(categoryTotals[cat.id] || 0), y);
        y += 6;
      });

      // Totals block
      y += 10;
      ensureSpace(90);
      doc.setFontSize(12);
      doc.setTextColor(17, 24, 40);
      doc.setFont('helvetica', 'bold');
      doc.text('Summary', startX, y);
      y += 8;
      const totals: Array<[string, string]> = [
        ['Subtotal', fmt(subtotal)],
        [`Contingency (${contingency}%)`, fmt(contingencyAmount)],
        ['Total', fmt(total)],
      ];
      totals.forEach(([label, value]) => {
        y += 18;
        drawDetailRow(label, value, y);
      });

      if (budget > 0) {
        y += 16;
        ensureSpace(48);
        const pct = (total / budget) * 100;
        drawDetailRow('Your budget', fmt(budget), y);
        y += 14;
        const barW = tableWidth;
        doc.setFillColor(226, 232, 240);
        doc.roundedRect(startX, y + 6, barW, 8, 4, 4, 'F');
        const barFill = pct <= 100 ? [34, 197, 133] : [239, 68, 55];
        doc.setFillColor(barFill[0], barFill[1], barFill[2]);
        doc.roundedRect(startX, y + 6, Math.min(barW, (barW * pct) / 100), 8, 4, 4, 'F');
        y += 30;
        drawDetailRow(remaining >= 0 ? 'Under budget' : 'Over budget', fmt(Math.abs(remaining)), y);
      }

      // Footer page numbers
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(148, 155, 170);
        doc.setFont('helvetica', 'normal');
        doc.text(`Page ${i} of ${pageCount} · Genie.ph`, W / 2, H - 24, { align: 'center' });
      }

      doc.save(`birthday-party-budget-${partyDate || 'philippines'}.pdf`);
    })();
  };

  const renderLineItem = (categoryId: string, item: BudgetItem) => {
    const isCustom = item.isCustom;
    const lockedQty = item.perGuest || item.perChild;
    return (
      <div
        key={item.id}
        className="grid grid-cols-1 gap-2 py-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_76px_minmax(120px,0.9fr)_110px] sm:items-center sm:gap-3"
      >
        <div>
          {isCustom ? (
            <>
              <input
                type="text"
                value={item.label}
                onChange={(e) => updateItem(categoryId, item.id, { label: e.target.value })}
                placeholder="Custom item name"
                    className="w-full rounded-lg border border-purple-100 px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
              />
              <input
                type="text"
                value={item.description}
                onChange={(e) => updateItem(categoryId, item.id, { description: e.target.value })}
                placeholder="Description (optional)"
                className="mt-1 w-full rounded-lg border border-purple-100 px-3 py-1 text-xs text-slate-600 placeholder-slate-400 focus:border-purple-500 focus:outline-none"
              />
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-900">{item.label}</p>
              <p className="text-xs text-slate-500">{item.description}</p>
            </>
          )}
        </div>
        <div>
          <input
            type="text"
            value={item.vendor ?? ''}
            onChange={(e) => updateItem(categoryId, item.id, { vendor: e.target.value })}
            placeholder="Details (Optional)"
            aria-label={`${item.label || 'Item'} details`}
            className="w-full rounded-lg border border-purple-100 px-3 py-2 text-xs text-slate-600 placeholder-slate-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:contents">
           <div className="contents">
             <div>
               <label
                 htmlFor={`${item.id}-qty`}
                  className={`block w-full cursor-pointer rounded-lg border border-purple-100 px-2 py-2 text-center text-sm text-slate-900 focus-within:border-purple-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-purple-500/30 ${
                    lockedQty ? 'bg-purple-50 text-slate-500' : ''
                  }`}
                 onClick={() => {
                   if (item.perGuest) focusGuestCount();
                   else if (item.perChild) focusChildCount();
                 }}
               >
                 <input
                   id={`${item.id}-qty`}
                   type="number"
                   min="0"
                   value={getQty(item)}
                   disabled={lockedQty}
                   onChange={(e) => handleQtyChange(categoryId, item.id, e.target.value)}
                   aria-label={`${item.label || 'Item'} quantity`}
                   className="w-full appearance-none bg-transparent text-center focus:outline-none"
                 />
                </label>
           </div>
         </div>
           <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
              {symbolMap[currency] || ''}
            </span>
            <input
              type="number"
              min="0"
              value={item.cost}
              onChange={(e) => handleCostChange(categoryId, item.id, e.target.value)}
              aria-label={`${item.label || 'Item'} unit cost`}
              className="w-full rounded-lg border border-purple-100 px-3 py-2 pl-7 text-sm text-slate-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <span className="text-sm font-bold text-slate-900">{formatCurrency(getLineTotal(item), currency)}</span>
          {isCustom && (
            <button
              onClick={() => handleRemoveItem(categoryId, item.id)}
              aria-label="Remove custom item"
              className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderCategory = (category: Category) => {
    const items = lineItems[category.id] || [];
    const Icon = categoryIcons[category.id] || Package;
    return (
      <div key={category.id} className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm">
        <div className="mb-1 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
              <Icon className="h-4.5 w-4.5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">{category.label}</h3>
              <p className="text-xs text-slate-500">{category.description}</p>
            </div>
          </div>
          <div className="text-base font-bold text-purple-700">
            {formatCurrency(categoryTotals[category.id] || 0, currency)}
          </div>
        </div>
         <div className="divide-y divide-dashed divide-slate-200">
          {visibleItems(items).map((item) => renderLineItem(category.id, item))}
        </div>
        <button
          onClick={() => handleAddItem(category.id)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-purple-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-purple-400 hover:text-purple-700"
        >
          <Plus className="h-3.5 w-3.5" />
          Add custom item
        </button>
      </div>
    );
  };

  return (
    <section ref={printRef} className="mt-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
           <div className="rounded-3xl border border-purple-100 bg-white p-6 shadow-sm md:p-8">
            <div className="mb-5">
              <h2 className="text-2xl font-black text-slate-900">Interactive Calculator</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 xs:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className={labelClass}>Party date</label>
                <input type="date" value={partyDate} onChange={(e) => setPartyDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Total guests</label>
                 <input
                   ref={guestCountRef}
                   type="number"
                   min="1"
                   value={guestCount}
                   onChange={(e) => setGuestCount(Math.max(1, parseInt(e.target.value) || 1))}
                   className={inputClass}
                 />
              </div>
              <div>
                <div className="flex items-end gap-3">
                  <div className="flex items-center gap-2">
                    <input
                      id="kidsAttending"
                      type="checkbox"
                      checked={kidsAttending}
                      onChange={(e) => setKidsAttending(e.target.checked)}
                      className="h-4 w-4 rounded border-purple-300 text-purple-600 focus:ring-2 focus:ring-purple-500/30"
                    />
                    <label htmlFor="kidsAttending" className={labelClass}>
                      Kids attending
                    </label>
                  </div>
                  {kidsAttending && (
                    <input
                      ref={childCountRef}
                      type="number"
                      min="0"
                      value={childCount}
                      onChange={(e) => setChildCount(Math.max(0, parseInt(e.target.value) || 0))}
                      className={inputClass}
                    />
                  )}
                </div>
              </div>
              <div>
                <label className={labelClass}>Overall budget (optional)</label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    {symbolMap[currency] || ''}
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={overallBudget}
                    onChange={(e) => setOverallBudget(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full rounded-lg border border-purple-100 px-3 py-2 pl-7 text-sm text-slate-900 placeholder-slate-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Contingency buffer (%)</label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={contingency}
                  onChange={(e) => setContingency(Math.max(0, Math.min(30, parseInt(e.target.value) || 0)))}
                  className={inputClass}
                />
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Your planner auto-saves in this browser. Use Save Details to keep it in your Genie.ph account.
            </p>
          </div>

          <div className="mt-5 space-y-5">{initialCategories.map((category) => renderCategory(category))}</div>
        </div>

        <aside className="self-start lg:sticky lg:top-24">
          <div className="rounded-3xl border border-purple-100 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Your running total</p>
            <p className="mt-2 text-4xl font-black text-slate-900">{formatCurrency(total, currency)}</p>
            <p className="mt-1 text-xs text-slate-500">
              {formatCurrency(total / guestCount, currency)} per guest &middot; {guestCount} guests &middot; incl.{' '}
              {contingency}% buffer
            </p>
            {budget > 0 ? (
              <div className="mt-4">
                <div className="h-2 w-full rounded-full bg-slate-200">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      remaining >= 0 ? 'bg-green-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(100, (total / budget) * 100)}%` }}
                  />
                </div>
                {remaining >= 0 ? (
                  <p className="mt-2 text-xs font-semibold text-green-700">
                    You are {formatCurrency(remaining, currency)} under budget
                  </p>
                ) : (
                  <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-red-700">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Over budget by {formatCurrency(Math.abs(remaining), currency)}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-4 rounded-lg bg-purple-50 px-3 py-2 text-xs text-slate-500">
                Add an overall budget above to track progress.
              </p>
            )}

            <div className="mt-5 space-y-2.5 border-t border-purple-100 pt-4">
              {initialCategories.map((cat, i) => {
                const catTotal = categoryTotals[cat.id] || 0;
                const pct = subtotal > 0 ? (catTotal / subtotal) * 100 : 0;
                return (
                  <div key={cat.id}>
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: breakdownPalette[i % breakdownPalette.length] }}
                      />
                      <span className="flex-1 truncate text-slate-600">{cat.label}</span>
                      <span className="font-semibold text-slate-900">{formatCurrency(catTotal, currency)}</span>
                    </div>
                    <div className="mt-1 h-1 w-full rounded-full bg-slate-100">
                      <div
                        className="h-1 rounded-full transition-all duration-300"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: breakdownPalette[i % breakdownPalette.length],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 space-y-2.5">
              <button
                type="button"
                onClick={handleSaveDetails}
                disabled={isSaving || isAuthLoading}
                className="genie-btn-primary inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold shadow-md disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isSaving ? 'Saving...' : 'Save Details'}
              </button>
              <button
                onClick={handleExportPDF}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-6 py-3 text-sm font-bold text-purple-700 shadow-sm transition-colors hover:bg-purple-100"
              >
                <Download className="h-4 w-4" />
                Export PDF
              </button>
              <button
                onClick={handleReset}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-purple-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-purple-50"
              >
                <FileText className="h-4 w-4" /> Reset planner
              </button>
            </div>
          </div>
        </aside>
      </div>
      {isSignupModalOpen ? <PartyBudgetSignupModal onClose={() => setIsSignupModalOpen(false)} /> : null}
    </section>
  );
}
