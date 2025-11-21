# Google AI Studio Prompt: Update Icing Color Container UI

**Task**: Update the customization page's "Change Icing Colors" container to match the current production version with enhanced toolbar labels and improved UX.

---

## CONTEXT

You are updating an older version of a React/TypeScript cake customization app. The main goal is to enhance the icing color toolbar in the customization page to include:

1. **Text labels below each icing toolbar icon** (Drip, Top Border, Base Border, Body Icing, Board)
2. **Purple hover states** on labels
3. **Purple active states** when selected
4. **Better spacing** between toolbar items

---

## FILES TO MODIFY

**Primary File**: `src/app/customizing/page.tsx`

---

## STEP-BY-STEP INSTRUCTIONS

### STEP 1: Locate the IcingToolbar Component

**Search for**: `const IcingToolbar` (around line 150-400)

This component renders the circular icons for drip, borders, icing, and board.

---

### STEP 2: Add Label Property to Tools Array

**Find**: The `tools` array definition (look for `const tools = icingColorsSame ? [...]`)

**Current structure** (what you have):
```typescript
const tools = icingColorsSame ? [
    { id: 'drip', description: 'Drip', icon: <img src={getDripImage()} alt="Drip effect" />, featureFlag: effectiveIcingDesign.drip },
    { id: 'borderTop', description: 'Top', icon: <img src={getTopBorderImage()} alt="Top border" />, featureFlag: effectiveIcingDesign.border_top },
    { id: 'borderBase', description: 'Bottom', icon: <img src={getBaseBorderImage()} alt="Base border" />, featureFlag: effectiveIcingDesign.border_base, disabled: isBento },
    { id: 'icing', description: 'Icing', icon: <img src={getIcingImage('top')} alt="Icing color" />, featureFlag: !!(effectiveIcingDesign.colors?.top || effectiveIcingDesign.colors?.side) },
    { id: 'gumpasteBaseBoard', description: 'Board', icon: <img src={getBaseboardImage()} alt="Gumpaste baseboard" />, featureFlag: effectiveIcingDesign.gumpasteBaseBoard, disabled: isBento },
] : [
    { id: 'drip', description: 'Drip', icon: <img src={getDripImage()} alt="Drip effect" />, featureFlag: effectiveIcingDesign.drip },
    { id: 'borderTop', description: 'Top', icon: <img src={getTopBorderImage()} alt="Top border" />, featureFlag: effectiveIcingDesign.border_top },
    { id: 'borderBase', description: 'Bottom', icon: <img src={getBaseBorderImage()} alt="Base border" />, featureFlag: effectiveIcingDesign.border_base, disabled: isBento },
    { id: 'top', description: 'Icing', icon: <img src={getIcingImage('top')} alt="Top icing" />, featureFlag: !!effectiveIcingDesign.colors?.top },
    { id: 'side', description: 'Icing', icon: <img src={getIcingImage('side')} alt="Side icing" />, featureFlag: !!effectiveIcingDesign.colors?.side },
    { id: 'gumpasteBaseBoard', description: 'Board', icon: <img src={getBaseboardImage()} alt="Gumpaste baseboard" />, featureFlag: effectiveIcingDesign.gumpasteBaseBoard, disabled: isBento },
];
```

**Updated structure** (what you need to change to):
```typescript
const tools = icingColorsSame ? [
    { id: 'drip', description: 'Drip', label: 'Drip', icon: <img src={getDripImage()} alt="Drip effect" />, featureFlag: effectiveIcingDesign.drip },
    { id: 'borderTop', description: 'Top', label: 'Top Border', icon: <img src={getTopBorderImage()} alt="Top border" />, featureFlag: effectiveIcingDesign.border_top },
    { id: 'borderBase', description: 'Bottom', label: 'Base Border', icon: <img src={getBaseBorderImage()} alt="Base border" />, featureFlag: effectiveIcingDesign.border_base, disabled: isBento },
    { id: 'icing', description: 'Icing', label: 'Body Icing', icon: <img src={getIcingImage('top')} alt="Icing color" />, featureFlag: !!(effectiveIcingDesign.colors?.top || effectiveIcingDesign.colors?.side) },
    { id: 'gumpasteBaseBoard', description: 'Board', label: 'Board', icon: <img src={getBaseboardImage()} alt="Gumpaste baseboard" />, featureFlag: effectiveIcingDesign.gumpasteBaseBoard, disabled: isBento },
] : [
    { id: 'drip', description: 'Drip', label: 'Drip', icon: <img src={getDripImage()} alt="Drip effect" />, featureFlag: effectiveIcingDesign.drip },
    { id: 'borderTop', description: 'Top', label: 'Top Border', icon: <img src={getTopBorderImage()} alt="Top border" />, featureFlag: effectiveIcingDesign.border_top },
    { id: 'borderBase', description: 'Bottom', label: 'Base Border', icon: <img src={getBaseBorderImage()} alt="Base border" />, featureFlag: effectiveIcingDesign.border_base, disabled: isBento },
    { id: 'top', description: 'Icing', label: 'Body Icing', icon: <img src={getIcingImage('top')} alt="Top icing" />, featureFlag: !!effectiveIcingDesign.colors?.top },
    { id: 'side', description: 'Icing', label: 'Body Icing', icon: <img src={getIcingImage('side')} alt="Side icing" />, featureFlag: !!effectiveIcingDesign.colors?.side },
    { id: 'gumpasteBaseBoard', description: 'Board', label: 'Board', icon: <img src={getBaseboardImage()} alt="Gumpaste baseboard" />, featureFlag: effectiveIcingDesign.gumpasteBaseBoard, disabled: isBento },
];
```

**What changed**: Added `label` property to each tool:
- `drip` → `label: 'Drip'`
- `borderTop` → `label: 'Top Border'`
- `borderBase` → `label: 'Base Border'`
- `icing`, `top`, `side` → `label: 'Body Icing'`
- `gumpasteBaseBoard` → `label: 'Board'`

---

### STEP 3: Update the IcingToolbar Return Statement

**Find**: The return statement inside the `IcingToolbar` component (look for `return ( <div className=...>`)

**Current structure** (what you likely have):
```typescript
return (
    <div className={`flex flex-row gap-2 justify-center transition-opacity ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {tools.map((tool, index) => {
            const isGuideActive = activeGuideIndex === index;
            const isSelected = selectedItem && 'description' in selectedItem && selectedItem.description === tool.description;
            return (
                <button
                    key={tool.id}
                    onClick={() => !tool.disabled && onSelectItem({ id: `icing-edit-${tool.id}`, itemCategory: 'icing', description: tool.description, cakeType: effectiveCakeType })}
                    className={`relative w-14 h-14 p-2 rounded-full hover:bg-purple-100 transition-all group ${isSelected ? 'bg-purple-100' : 'bg-white/80'} backdrop-blur-md border border-slate-200 shadow-md ${tool.featureFlag ? '' : 'opacity-60'} ${isGuideActive ? 'ring-4 ring-pink-500 ring-offset-2 scale-110 shadow-xl' : ''} disabled:opacity-40 disabled:cursor-not-allowed`}
                    disabled={tool.disabled}
                >
                    {React.cloneElement(tool.icon as React.ReactElement<any>, { className: 'w-full h-full object-contain' })}
                    {tool.disabled && (
                         <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full">
                            <X className="w-6 h-6 text-white" />
                         </div>
                    )}
                </button>
            );
        })}
    </div>
);
```

**Updated structure** (what you need to change to):
```typescript
return (
    <div className={`flex flex-row gap-3 justify-center transition-opacity ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {tools.map((tool, index) => {
            const isGuideActive = activeGuideIndex === index;
            const isSelected = selectedItem && 'description' in selectedItem && selectedItem.description === tool.description;
            return (
                <div key={tool.id} className="flex flex-col items-center gap-1 group">
                    <button
                        onClick={() => !tool.disabled && onSelectItem({ id: `icing-edit-${tool.id}`, itemCategory: 'icing', description: tool.description, cakeType: effectiveCakeType })}
                        className={`relative w-14 h-14 p-2 rounded-full hover:bg-purple-100 transition-all ${isSelected ? 'bg-purple-100' : 'bg-white/80'} backdrop-blur-md border border-slate-200 shadow-md ${tool.featureFlag ? '' : 'opacity-60'} ${isGuideActive ? 'ring-4 ring-pink-500 ring-offset-2 scale-110 shadow-xl' : ''} disabled:opacity-40 disabled:cursor-not-allowed`}
                        disabled={tool.disabled}
                    >
                        {React.cloneElement(tool.icon as React.ReactElement<any>, { className: 'w-full h-full object-contain' })}
                        {tool.disabled && (
                             <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full">
                                <X className="w-6 h-6 text-white" />
                             </div>
                        )}
                    </button>
                    <span className={`text-[10px] font-medium transition-colors whitespace-nowrap ${isSelected ? 'text-purple-600' : 'text-slate-600 group-hover:text-purple-600'} ${tool.disabled ? 'opacity-40' : ''}`}>
                        {tool.label}
                    </span>
                </div>
            );
        })}
    </div>
);
```

**What changed**:

1. **Outer container**: Changed `gap-2` to `gap-3` for better spacing

2. **Wrapper div added**: Each tool is now wrapped in:
   ```typescript
   <div key={tool.id} className="flex flex-col items-center gap-1 group">
   ```
   - `flex flex-col` = vertical layout
   - `items-center` = center items
   - `gap-1` = small gap between button and label
   - `group` = enables group-hover for child elements

3. **Button changes**: Removed `group` class from button, removed `key` (moved to wrapper div)

4. **Label added**: After the button, inside the wrapper div:
   ```typescript
   <span className={`text-[10px] font-medium transition-colors whitespace-nowrap ${isSelected ? 'text-purple-600' : 'text-slate-600 group-hover:text-purple-600'} ${tool.disabled ? 'opacity-40' : ''}`}>
       {tool.label}
   </span>
   ```

   **Label styling explained**:
   - `text-[10px]` = Very small text (10 pixels)
   - `font-medium` = Medium font weight
   - `transition-colors` = Smooth color transitions
   - `whitespace-nowrap` = Don't wrap text to new line
   - **Default state**: `text-slate-600` (gray)
   - **Hover state**: `group-hover:text-purple-600` (purple on hover)
   - **Selected state**: `text-purple-600` (purple when selected)
   - **Disabled state**: `opacity-40` (faded when disabled)

---

## VISUAL RESULT

After these changes, the icing toolbar will look like this:

```
[Drip Icon]    [Top Border Icon]    [Base Border Icon]    [Body Icing Icon]    [Board Icon]
   Drip           Top Border            Base Border           Body Icing           Board
```

**Behavior**:
- Labels start as **gray** (`text-slate-600`)
- On **hover**: Labels turn **purple** (`text-purple-600`)
- When **selected**: Labels stay **purple** (`text-purple-600`)
- **Smooth transitions** between colors

---

## VERIFICATION CHECKLIST

After making these changes, verify:

1. ✅ **Labels appear** below each icing toolbar icon
2. ✅ **5 labels total**: "Drip", "Top Border", "Base Border", "Body Icing", "Board"
3. ✅ **Labels are gray** by default
4. ✅ **Labels turn purple** when you hover over a tool
5. ✅ **Labels stay purple** when a tool is selected/active
6. ✅ **Spacing is better** between toolbar items (gap-3 instead of gap-2)
7. ✅ **Text doesn't wrap** (stays on one line)
8. ✅ **Disabled tools** have faded labels (40% opacity)
9. ✅ **No console errors**
10. ✅ **Responsive** - works on mobile and desktop

---

## TROUBLESHOOTING

### Issue: Labels don't appear
**Solution**: Make sure you added the `label` property to ALL tools in BOTH arrays (icingColorsSame and non-matching)

### Issue: Hover doesn't work on labels
**Solution**: Ensure the wrapper div has `group` class and the span has `group-hover:text-purple-600`

### Issue: TypeScript error on `tool.label`
**Solution**: If using TypeScript, update the tool type definition to include `label?: string`

### Issue: Labels are too big/small
**Solution**: Adjust `text-[10px]` to your preferred size (e.g., `text-[12px]` for larger)

### Issue: Purple color is wrong shade
**Solution**: Change `text-purple-600` to match your design system (e.g., `text-purple-500`, `text-purple-700`)

---

## COMPLETE CODE REFERENCE

### Tools Array (Both Variations)

```typescript
// When icing colors match (combined icing tool)
const tools = icingColorsSame ? [
    { id: 'drip', description: 'Drip', label: 'Drip', icon: <img src={getDripImage()} alt="Drip effect" />, featureFlag: effectiveIcingDesign.drip },
    { id: 'borderTop', description: 'Top', label: 'Top Border', icon: <img src={getTopBorderImage()} alt="Top border" />, featureFlag: effectiveIcingDesign.border_top },
    { id: 'borderBase', description: 'Bottom', label: 'Base Border', icon: <img src={getBaseBorderImage()} alt="Base border" />, featureFlag: effectiveIcingDesign.border_base, disabled: isBento },
    { id: 'icing', description: 'Icing', label: 'Body Icing', icon: <img src={getIcingImage('top')} alt="Icing color" />, featureFlag: !!(effectiveIcingDesign.colors?.top || effectiveIcingDesign.colors?.side) },
    { id: 'gumpasteBaseBoard', description: 'Board', label: 'Board', icon: <img src={getBaseboardImage()} alt="Gumpaste baseboard" />, featureFlag: effectiveIcingDesign.gumpasteBaseBoard, disabled: isBento },
] : [
    // When icing colors DON'T match (separate top/side tools)
    { id: 'drip', description: 'Drip', label: 'Drip', icon: <img src={getDripImage()} alt="Drip effect" />, featureFlag: effectiveIcingDesign.drip },
    { id: 'borderTop', description: 'Top', label: 'Top Border', icon: <img src={getTopBorderImage()} alt="Top border" />, featureFlag: effectiveIcingDesign.border_top },
    { id: 'borderBase', description: 'Bottom', label: 'Base Border', icon: <img src={getBaseBorderImage()} alt="Base border" />, featureFlag: effectiveIcingDesign.border_base, disabled: isBento },
    { id: 'top', description: 'Icing', label: 'Body Icing', icon: <img src={getIcingImage('top')} alt="Top icing" />, featureFlag: !!effectiveIcingDesign.colors?.top },
    { id: 'side', description: 'Icing', label: 'Body Icing', icon: <img src={getIcingImage('side')} alt="Side icing" />, featureFlag: !!effectiveIcingDesign.colors?.side },
    { id: 'gumpasteBaseBoard', description: 'Board', label: 'Board', icon: <img src={getBaseboardImage()} alt="Gumpaste baseboard" />, featureFlag: effectiveIcingDesign.gumpasteBaseBoard, disabled: isBento },
];
```

### Return Statement (Complete)

```typescript
return (
    <div className={`flex flex-row gap-3 justify-center transition-opacity ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {tools.map((tool, index) => {
            const isGuideActive = activeGuideIndex === index;
            const isSelected = selectedItem && 'description' in selectedItem && selectedItem.description === tool.description;
            return (
                <div key={tool.id} className="flex flex-col items-center gap-1 group">
                    <button
                        onClick={() => !tool.disabled && onSelectItem({ id: `icing-edit-${tool.id}`, itemCategory: 'icing', description: tool.description, cakeType: effectiveCakeType })}
                        className={`relative w-14 h-14 p-2 rounded-full hover:bg-purple-100 transition-all ${isSelected ? 'bg-purple-100' : 'bg-white/80'} backdrop-blur-md border border-slate-200 shadow-md ${tool.featureFlag ? '' : 'opacity-60'} ${isGuideActive ? 'ring-4 ring-pink-500 ring-offset-2 scale-110 shadow-xl' : ''} disabled:opacity-40 disabled:cursor-not-allowed`}
                        disabled={tool.disabled}
                    >
                        {React.cloneElement(tool.icon as React.ReactElement<any>, { className: 'w-full h-full object-contain' })}
                        {tool.disabled && (
                             <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full">
                                <X className="w-6 h-6 text-white" />
                             </div>
                        )}
                    </button>
                    <span className={`text-[10px] font-medium transition-colors whitespace-nowrap ${isSelected ? 'text-purple-600' : 'text-slate-600 group-hover:text-purple-600'} ${tool.disabled ? 'opacity-40' : ''}`}>
                        {tool.label}
                    </span>
                </div>
            );
        })}
    </div>
);
```

---

## SUMMARY OF CHANGES

| Change | Before | After | Why |
|--------|--------|-------|-----|
| Tools array | No `label` property | Added `label: 'X'` to each tool | Display text below icons |
| Outer container gap | `gap-2` | `gap-3` | Better spacing |
| Button wrapper | Direct button mapping | Wrapped in flex column div | Enable vertical layout |
| Label element | None | `<span>` with label text | Show tool name |
| Group class | On button | On wrapper div | Enable group-hover for label |
| Label color states | N/A | Gray → Purple (hover/active) | Visual feedback |

---

## EXECUTION INSTRUCTIONS FOR GOOGLE AI STUDIO

1. Open the file `src/app/customizing/page.tsx`
2. Find the `IcingToolbar` component (search for `const IcingToolbar`)
3. Locate the `tools` array definition
4. Add the `label` property to each tool in BOTH arrays
5. Find the return statement of `IcingToolbar`
6. Replace the button mapping with the new structure that includes wrapper div and label span
7. Save the file
8. Test in browser to verify labels appear and turn purple on hover/selection

---

**End of Prompt**

This prompt is ready to copy-paste into Google AI Studio for automated code modification.
