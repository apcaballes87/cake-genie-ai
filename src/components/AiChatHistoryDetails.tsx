'use client';

import React from 'react';
import { normalizeAiChatHistory } from '@/lib/commerce/aiChatHistory';

interface AiChatHistoryDetailsProps {
    historySource: {
        ai_chat_history?: unknown;
        chat_history?: unknown;
    } | null | undefined;
}

const AiChatHistoryDetails: React.FC<AiChatHistoryDetailsProps> = ({ historySource }) => {
    const entries = normalizeAiChatHistory(historySource);

    if (entries.length === 0) {
        return null;
    }

    return (
        <div className="pt-1" data-testid="ai-chat-history-details">
            <p className="text-slate-500 text-xs mb-2">AI Chat Requests:</p>
            <div className="space-y-2">
                {entries.map((entry, index) => (
                    <div
                        key={`${entry.createdAt || 'legacy'}-${index}`}
                        className="rounded-lg border border-slate-200 bg-white/70 px-3 py-2"
                    >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                            Request {index + 1}
                        </p>
                        <p className="mt-1 text-xs font-medium text-slate-700 whitespace-pre-wrap break-words">
                            {entry.prompt}
                        </p>
                        {entry.referenceImageUrl ? (
                            <a
                                href={entry.referenceImageUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 inline-flex items-center gap-2 text-[11px] font-semibold text-purple-600 hover:text-purple-700"
                            >
                                <img
                                    src={entry.referenceImageUrl}
                                    alt={entry.referenceImageName || `AI chat reference image ${index + 1}`}
                                    className="h-10 w-10 rounded-md border border-slate-200 object-cover"
                                />
                                <span>{entry.referenceImageName || 'View reference image'}</span>
                            </a>
                        ) : null}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default React.memo(AiChatHistoryDetails);
