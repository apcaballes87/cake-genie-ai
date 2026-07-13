'use client';

import React from 'react';
import { Send, Sparkles, X } from 'lucide-react';
import { Loader2, PhotoIcon } from '../../components/icons';
import { ColorPalette } from '../../components/ColorPalette';
import type { ParsedAiChatPromptTemplate } from '@/utils/aiChatPromptComposer';

export interface CustomizingAiPromptSuggestionItem {
    suggestion: string;
    template: ParsedAiChatPromptTemplate | null;
}

interface CustomizingAiChatPanelProps {
    className?: string;
    containerRef: React.RefObject<HTMLFormElement | null>;
    inputRef: React.RefObject<HTMLTextAreaElement | null>;
    chatInput: string;
    selectedAiPromptTemplate: ParsedAiChatPromptTemplate | null;
    selectedAiPromptColor: string;
    showAiPromptColorPicker: boolean;
    showAiPromptSuggestions: boolean;
    filteredAiChatPromptSuggestions: CustomizingAiPromptSuggestionItem[];
    selectedAiPromptIndex: number;
    isAiProcessing: boolean;
    isUpdatingDesign: boolean;
    attachedImageName?: string | null;
    isAttachmentUploading?: boolean;
    onSubmit: (event?: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
    onAttachmentSelect: (file: File) => void | Promise<void>;
    onAttachmentClear: () => void;
    onTemplateColorPickerToggle: () => void;
    onTemplateClear: () => void;
    onTemplateColorChange: (color: string) => void | Promise<void>;
    onInputChange: (value: string) => void;
    onInputInteract: () => void;
    onInputBlur?: () => void;
    onInputKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    onSuggestionSelect: (suggestion: string) => void;
    placeholder?: string;
    title?: string;
    suggestionsPlacement?: 'above' | 'below';
}

export const CustomizingAiChatPanel = React.memo(({
    className,
    containerRef,
    inputRef,
    chatInput,
    selectedAiPromptTemplate,
    selectedAiPromptColor,
    showAiPromptColorPicker,
    showAiPromptSuggestions,
    filteredAiChatPromptSuggestions,
    selectedAiPromptIndex,
    isAiProcessing,
    isUpdatingDesign,
    attachedImageName,
    isAttachmentUploading = false,
    onSubmit,
    onAttachmentSelect,
    onAttachmentClear,
    onTemplateColorPickerToggle,
    onTemplateClear,
    onTemplateColorChange,
    onInputChange,
    onInputInteract,
    onInputBlur,
    onInputKeyDown,
    onSuggestionSelect,
    placeholder = "✨ Tell Genie your cake design wish...",
    title,
    suggestionsPlacement = 'above',
}: CustomizingAiChatPanelProps) => {
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);
    const isAttachmentDisabled = isAiProcessing || isUpdatingDesign || isAttachmentUploading;

    React.useLayoutEffect(() => {
        if (selectedAiPromptTemplate) return;

        const textarea = inputRef.current;
        if (!textarea) return;

        const computedStyle = window.getComputedStyle(textarea);
        const lineHeight = Number.parseFloat(computedStyle.lineHeight);
        const verticalPadding = Number.parseFloat(computedStyle.paddingTop) + Number.parseFloat(computedStyle.paddingBottom);
        const minHeight = Number.parseFloat(computedStyle.minHeight);
        const baseHeight = Number.isFinite(minHeight) ? minHeight : 39;
        const maxHeight = ((Number.isFinite(lineHeight) ? lineHeight : 18) * 3) + verticalPadding;

        textarea.style.height = 'auto';
        const measuredHeight = Math.min(textarea.scrollHeight, maxHeight);
        const shouldKeepCompactHeight = measuredHeight <= baseHeight + 4;
        textarea.style.height = `${shouldKeepCompactHeight ? baseHeight : Math.max(baseHeight, measuredHeight)}px`;
        textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
    }, [chatInput, inputRef, selectedAiPromptTemplate]);

    const handleTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        onInputKeyDown(event);

        if (event.defaultPrevented) {
            return;
        }
    };
    const suggestionsPlacementClassName = suggestionsPlacement === 'below'
        ? 'top-full mt-2 slide-in-from-top-2'
        : 'bottom-full mb-2 slide-in-from-bottom-2';

    return (
        <div className={className}>
            {title && (
                <h3 className="text-[13px] max-md:text-[11px] font-semibold text-slate-800 mb-2.5 px-1 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                    {title}
                </h3>
            )}
            <form onSubmit={(event) => { void onSubmit(event); }} className="relative" ref={containerRef}>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                            void onAttachmentSelect(file);
                        }
                        event.target.value = '';
                    }}
                />
                <div className="flex items-start gap-2">
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isAttachmentDisabled}
                        aria-label="Attach reference image"
                        className="shrink-0 h-[41px] w-[41px] rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center"
                    >
                        {isAttachmentUploading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <PhotoIcon className="w-4 h-4" />
                        )}
                    </button>
                    <div className="relative min-w-0 flex-1">
                        {selectedAiPromptTemplate ? (
                            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-12 shadow-sm">
                                <div className="flex items-start gap-2 text-sm max-md:text-xs leading-6 max-md:leading-5 text-slate-700">
                                    <span className="min-w-0 flex-1 wrap-break-word">
                                        {selectedAiPromptTemplate.prefix}
                                        <button
                                            type="button"
                                            onClick={onTemplateColorPickerToggle}
                                            className="mx-1 inline-flex rounded-full bg-purple-50 px-2.5 py-0.5 font-bold text-purple-700 underline decoration-purple-300 underline-offset-2 transition hover:bg-purple-100"
                                        >
                                            {selectedAiPromptTemplate.placeholderLabel}
                                        </button>
                                        {selectedAiPromptTemplate.suffix}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={onTemplateClear}
                                        className="shrink-0 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                                        aria-label="Edit prompt as text"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                                {showAiPromptColorPicker && (
                                    <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                                        <div className="mb-2 text-[11px] max-md:text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                            Choose {selectedAiPromptTemplate.placeholderLabel}
                                        </div>
                                        <ColorPalette
                                            selectedColor={selectedAiPromptColor}
                                            onColorChange={(color) => { void onTemplateColorChange(color); }}
                                        />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="relative min-h-[41px] rounded-xl border border-slate-200 bg-white shadow-sm transition-all focus-within:border-transparent focus-within:ring-2 focus-within:ring-purple-500">
                                <textarea
                                    ref={inputRef}
                                    value={chatInput}
                                    onChange={(event) => onInputChange(event.target.value)}
                                    onFocus={onInputInteract}
                                    onBlur={onInputBlur}
                                    onClick={onInputInteract}
                                    onKeyDown={handleTextareaKeyDown}
                                    placeholder={placeholder}
                                    disabled={isAiProcessing || isUpdatingDesign}
                                    autoComplete="off"
                                    rows={1}
                                    className="block w-full min-h-[39px] resize-none overflow-hidden rounded-xl bg-transparent pl-4 pr-12 py-[11px] max-md:py-2.5 text-[12px] max-md:text-[10px] leading-[17px] max-md:leading-[15px] focus:outline-none disabled:opacity-50 disabled:bg-slate-50 placeholder:text-slate-400"
                                />
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={!chatInput.trim() || isAiProcessing || isUpdatingDesign || !!selectedAiPromptTemplate}
                            className="absolute right-1 top-1 h-[33px] w-[33px] bg-linear-to-r from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800 text-white rounded-lg transition-all flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label="Submit AI Edit"
                        >
                            {isAiProcessing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                        </button>
                    </div>
                </div>
                {showAiPromptSuggestions && filteredAiChatPromptSuggestions.length > 0 && !isAiProcessing && !isUpdatingDesign && (
                    <div className={`absolute left-0 right-0 z-9999 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl animate-in fade-in duration-200 ${suggestionsPlacementClassName}`}>
                        <div className="max-h-72 overflow-y-auto py-0.5">
                            {filteredAiChatPromptSuggestions.map(({ suggestion, template }, index) => (
                                <button
                                    key={suggestion}
                                    type="button"
                                    onMouseDown={(event) => {
                                        // Prevent input focus loss
                                        event.preventDefault();
                                    }}
                                    onClick={() => onSuggestionSelect(suggestion)}
                                    className={`block w-full px-3 py-2 text-left text-[12px] max-md:text-[10px] leading-4 transition-colors cursor-pointer active:bg-purple-100 ${selectedAiPromptIndex === index ? 'bg-purple-50 text-purple-700' : 'text-slate-700 hover:bg-slate-50'}`}
                                    aria-label={`Select suggestion: ${suggestion}`}
                                >
                                    {template ? (
                                        <span className="wrap-break-word">
                                            {template.prefix}
                                            <span className="mx-1 inline-flex rounded-full bg-purple-50 px-1.5 py-0.5 text-[11px] max-md:text-[10px] leading-4 font-bold text-purple-700">
                                                {template.placeholderLabel}
                                            </span>
                                            {template.suffix}
                                        </span>
                                    ) : suggestion}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {attachedImageName && (
                    <div className="mt-2 flex items-center gap-2 rounded-2xl border border-purple-100 bg-purple-50/70 px-3 py-2 text-xs text-slate-600">
                        <PhotoIcon className="w-3.5 h-3.5 shrink-0 text-purple-600" />
                        <span className="min-w-0 flex-1 truncate font-medium">{attachedImageName}</span>
                        <button
                            type="button"
                            onClick={onAttachmentClear}
                            className="shrink-0 rounded-full p-1 text-slate-400 transition hover:bg-white hover:text-slate-600"
                            aria-label="Remove attached image"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                )}
            </form>
            {isAiProcessing && (
                <p className="text-[10px] max-md:text-[9px] text-purple-500 font-medium mt-1.5 animate-pulse flex items-center gap-1 px-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Redesigning your cake...
                </p>
            )}
        </div>
    );
});

CustomizingAiChatPanel.displayName = 'CustomizingAiChatPanel';
