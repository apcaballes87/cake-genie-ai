'use client';

import React from 'react';
import { X } from 'lucide-react';
import { Loader2 } from '../../components/icons';
import { ColorPalette } from '../../components/ColorPalette';
import type { ParsedAiChatPromptTemplate } from '@/utils/aiChatPromptComposer';

export interface CustomizingAiPromptSuggestionItem {
    suggestion: string;
    template: ParsedAiChatPromptTemplate | null;
}

interface CustomizingAiChatPanelProps {
    className?: string;
    containerRef: React.RefObject<HTMLFormElement | null>;
    inputRef: React.RefObject<HTMLInputElement | null>;
    chatInput: string;
    selectedAiPromptTemplate: ParsedAiChatPromptTemplate | null;
    selectedAiPromptColor: string;
    showAiPromptColorPicker: boolean;
    showAiPromptSuggestions: boolean;
    filteredAiChatPromptSuggestions: CustomizingAiPromptSuggestionItem[];
    selectedAiPromptIndex: number;
    isAiProcessing: boolean;
    isUpdatingDesign: boolean;
    onSubmit: (event?: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
    onTemplateColorPickerToggle: () => void;
    onTemplateClear: () => void;
    onTemplateColorChange: (color: string) => void | Promise<void>;
    onInputChange: (value: string) => void;
    onInputInteract: () => void;
    onInputBlur?: () => void;
    onInputKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
    onSuggestionSelect: (suggestion: string) => void;
    placeholder?: string;
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
    onSubmit,
    onTemplateColorPickerToggle,
    onTemplateClear,
    onTemplateColorChange,
    onInputChange,
    onInputInteract,
    onInputBlur,
    onInputKeyDown,
    onSuggestionSelect,
    placeholder = "✨ Tell Genie your cake design wish...",
}: CustomizingAiChatPanelProps) => (
    <div className={className}>
        <h3 className="text-[13px] font-semibold text-slate-800 mb-2 px-1">AI Customization Chat</h3>
        <form onSubmit={(event) => { void onSubmit(event); }} className="relative" ref={containerRef}>
            {selectedAiPromptTemplate ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-12 shadow-sm">
                    <div className="flex items-start gap-2 text-sm leading-6 text-slate-700">
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
                            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
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
                <input
                    ref={inputRef}
                    type="text"
                    value={chatInput}
                    onChange={(event) => onInputChange(event.target.value)}
                    onFocus={onInputInteract}
                    onBlur={onInputBlur}
                    onClick={onInputInteract}
                    onKeyDown={onInputKeyDown}
                    placeholder={placeholder}
                    disabled={isAiProcessing || isUpdatingDesign}
                    autoComplete="off"
                    className="w-full pl-4 pr-12 py-3 bg-white border border-slate-200 rounded-2xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all disabled:opacity-50 disabled:bg-slate-50 placeholder:text-slate-400"
                />
            )}
            {showAiPromptSuggestions && filteredAiChatPromptSuggestions.length > 0 && !isAiProcessing && !isUpdatingDesign && (
                <div className="absolute left-0 right-0 bottom-full z-[9999] mb-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="max-h-72 overflow-y-auto py-1">
                        {filteredAiChatPromptSuggestions.map(({ suggestion, template }, index) => (
                            <button
                                key={suggestion}
                                type="button"
                                onMouseDown={(event) => {
                                    // Prevent input focus loss
                                    event.preventDefault();
                                }}
                                onClick={() => onSuggestionSelect(suggestion)}
                                className={`block w-full px-4 py-3 text-left text-sm transition-colors cursor-pointer active:bg-purple-100 ${selectedAiPromptIndex === index ? 'bg-purple-50 text-purple-700' : 'text-slate-700 hover:bg-slate-50'}`}
                                aria-label={`Select suggestion: ${suggestion}`}
                            >
                                {template ? (
                                    <span className="wrap-break-word">
                                        {template.prefix}
                                        <span className="mx-1 inline-flex rounded-full bg-purple-50 px-2 py-0.5 font-bold text-purple-700">
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
            <button
                type="submit"
                disabled={!chatInput.trim() || isAiProcessing || isUpdatingDesign || !!selectedAiPromptTemplate}
                className="absolute right-1.5 top-1.5 bottom-1.5 bg-linear-to-r from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800 text-white px-2.5 rounded-xl transition-all flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                aria-label="Submit AI Edit"
            >
                {isAiProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                )}
            </button>
        </form>

        {isAiProcessing && (
            <p className="text-[10px] text-purple-500 font-medium mt-1.5 animate-pulse flex items-center gap-1 px-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Redesigning your cake...
            </p>
        )}
    </div>
));

CustomizingAiChatPanel.displayName = 'CustomizingAiChatPanel';