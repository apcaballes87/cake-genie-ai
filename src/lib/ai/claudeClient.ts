import Anthropic from '@anthropic-ai/sdk';
import {
    buildPixelCoordinateInstruction,
    convertPixelCoordinatesToNormalized,
    prepareClaudeImage,
} from '@/lib/ai/claudePixelCoordinates';

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
    if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY is not configured.');
    }
    client ??= new Anthropic({ maxRetries: 1 });
    return client;
}

// Claude structured outputs reject numeric/length/array-size constraints;
// those are still enforced by the application validator after parsing.
const DROPPED_KEYS = new Set([
    'minimum', 'maximum', 'minItems', 'maxItems', 'minLength', 'maxLength',
    'propertyOrdering', 'nullable', 'example', 'title', 'pattern', 'default',
]);

/** Converts a Gemini `Type.*` response schema into Claude-compatible JSON Schema. */
export function geminiSchemaToJsonSchema(schema: unknown): unknown {
    if (Array.isArray(schema)) return schema.map(geminiSchemaToJsonSchema);
    if (!schema || typeof schema !== 'object') return schema;

    const source = schema as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(source)) {
        if (DROPPED_KEYS.has(key)) continue;
        if (key === 'type' && typeof value === 'string') {
            const type = value.toLowerCase();
            out.type = source.nullable === true ? [type, 'null'] : type;
        } else if (key === 'properties' && value && typeof value === 'object') {
            out.properties = Object.fromEntries(
                Object.entries(value).map(([name, child]) => [name, geminiSchemaToJsonSchema(child)]),
            );
        } else {
            out[key] = geminiSchemaToJsonSchema(value);
        }
    }
    if (out.type === 'object' || (Array.isArray(out.type) && out.type.includes('object'))) {
        out.additionalProperties = false;
    }
    if (Array.isArray(out.enum) && source.nullable === true) out.enum = [...out.enum, null];
    return out;
}

function stripJsonFences(text: string): string {
    const fenced = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
    return fenced ? fenced[1] : text.trim();
}

type ClaudeImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

export async function generateClaudeJson({
    model,
    systemInstruction,
    promptText,
    imageData,
    mimeType,
    repairInstruction,
    responseSchema,
    timeoutMs,
}: {
    model: string;
    systemInstruction: string;
    promptText: string;
    imageData: string;
    mimeType: string;
    repairInstruction?: string;
    responseSchema: unknown;
    timeoutMs: number;
}): Promise<string> {
    const anthropic = getAnthropic();
    const jsonSchema = geminiSchemaToJsonSchema(responseSchema) as Record<string, unknown>;

    // Responses that carry boxes or geometry lines are requested in pixels and
    // converted to the 0–1000 contract afterwards; Claude does not reliably
    // normalize on its own.
    const usesCoordinates = JSON.stringify(jsonSchema).includes('"box_2d"');
    const preparedImage = usesCoordinates ? await prepareClaudeImage(imageData, mimeType) : null;
    const sentImageData = preparedImage?.data ?? imageData;
    const sentMimeType = preparedImage?.mimeType ?? mimeType;
    const userText = [
        repairInstruction ?? 'Analyze this cake image and return the JSON object.',
        preparedImage ? buildPixelCoordinateInstruction(preparedImage.width, preparedImage.height) : null,
    ].filter(Boolean).join('\n\n');

    const buildParams = (withSchema: boolean): Anthropic.MessageCreateParamsNonStreaming => ({
        model,
        max_tokens: 16000,
        // Speed over depth: this is a latency-sensitive extraction route.
        output_config: {
            effort: 'low',
            ...(withSchema ? { format: { type: 'json_schema', schema: jsonSchema } } : {}),
        },
        // Stable prefix (system + analysis prompt) is cached; only the image varies.
        system: [
            { type: 'text', text: systemInstruction },
            {
                type: 'text',
                text: withSchema
                    ? promptText
                    : `${promptText}\n\nRespond with only one JSON object matching this JSON Schema:\n${JSON.stringify(jsonSchema)}`,
                cache_control: { type: 'ephemeral' },
            },
        ],
        messages: [{
            role: 'user',
            content: [
                {
                    type: 'image',
                    source: { type: 'base64', media_type: sentMimeType as ClaudeImageMediaType, data: sentImageData },
                },
                { type: 'text', text: userText },
            ],
        }],
    });

    let response: Anthropic.Message;
    try {
        response = await anthropic.messages.create(buildParams(true), { timeout: timeoutMs });
    } catch (error) {
        // A schema the structured-output compiler cannot accept surfaces as a
        // 400; retry once with prompt-only JSON and rely on app validation.
        if (!(error instanceof Anthropic.BadRequestError)) throw error;
        console.warn('[Claude] Structured output schema rejected; retrying with prompt-only JSON.', error.message);
        response = await anthropic.messages.create(buildParams(false), { timeout: timeoutMs });
    }

    if (response.stop_reason === 'refusal') {
        throw new Error('Claude declined to analyze this image.');
    }
    const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');
    const jsonText = stripJsonFences(text);
    return preparedImage
        ? convertResponseToNormalized(jsonText, preparedImage.width, preparedImage.height)
        : jsonText;
}

function convertResponseToNormalized(jsonText: string, width: number, height: number): string {
    let parsed: unknown;
    try {
        parsed = JSON.parse(jsonText);
    } catch {
        // Leave malformed output for the caller's normal validation/repair path.
        return jsonText;
    }
    const { value, converted, skippedReason } = convertPixelCoordinatesToNormalized(parsed, width, height);
    if (skippedReason) {
        console.warn(`[Claude] Left coordinates unconverted (${skippedReason}); image is ${width}×${height}.`);
    }
    return converted ? JSON.stringify(value) : jsonText;
}
