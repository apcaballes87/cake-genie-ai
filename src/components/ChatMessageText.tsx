interface ChatMessageTextProps {
    text: string;
    linkClassName?: string;
}

interface ChatMessageTextPart {
    text: string;
    href?: string;
}

const CHAT_URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;

function splitTrailingUrlPunctuation(value: string): { url: string; trailingText: string } {
    let url = value;
    let trailingText = '';

    while (/[.,!?;:]$/.test(url)) {
        trailingText = `${url.slice(-1)}${trailingText}`;
        url = url.slice(0, -1);
    }

    while (url.endsWith(')')) {
        const openingParentheses = (url.match(/\(/g) || []).length;
        const closingParentheses = (url.match(/\)/g) || []).length;
        if (closingParentheses <= openingParentheses) break;

        trailingText = `)${trailingText}`;
        url = url.slice(0, -1);
    }

    return { url, trailingText };
}

export function splitChatMessageText(text: string): ChatMessageTextPart[] {
    const parts: ChatMessageTextPart[] = [];
    let lastIndex = 0;

    for (const match of text.matchAll(CHAT_URL_PATTERN)) {
        const matchStart = match.index ?? 0;
        const matchText = match[0];

        if (matchStart > lastIndex) {
            parts.push({ text: text.slice(lastIndex, matchStart) });
        }

        const { url, trailingText } = splitTrailingUrlPunctuation(matchText);
        if (!url) {
            parts.push({ text: matchText });
        } else {
            parts.push({ text: url, href: url });
            if (trailingText) {
                parts.push({ text: trailingText });
            }
        }

        lastIndex = matchStart + matchText.length;
    }

    if (lastIndex < text.length) {
        parts.push({ text: text.slice(lastIndex) });
    }

    return parts;
}

export function ChatMessageText({ text, linkClassName = 'text-purple-700 underline hover:text-purple-900' }: ChatMessageTextProps) {
    return (
        <p className="text-sm whitespace-pre-wrap break-words">
            {splitChatMessageText(text).map((part, index) =>
                part.href ? (
                    <a
                        key={`${part.href}-${index}`}
                        href={part.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={linkClassName}
                    >
                        {part.text}
                    </a>
                ) : (
                    <span key={`text-${index}`}>{part.text}</span>
                )
            )}
        </p>
    );
}
