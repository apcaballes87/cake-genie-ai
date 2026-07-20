import { Type } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

import {
    AI_CHAT_ACTION_TYPES,
    AI_CHAT_CAKE_FAMILIES,
    AI_CHAT_CAKE_FLAVORS,
    AI_CHAT_CAKE_THICKNESSES,
    AI_CHAT_EDIT_OUTCOMES,
    AI_CHAT_ICING_BASES,
    AI_CHAT_ICING_COLOR_TYPES,
    AI_CHAT_MAIN_TOPPER_TYPES,
    AI_CHAT_MESSAGE_POSITIONS,
    AI_CHAT_MESSAGE_TYPES,
    AI_CHAT_OPERATION_TYPES,
    AI_CHAT_SIZES,
    AI_CHAT_SUPPORT_ELEMENT_TYPES,
    AI_CHAT_TOPPER_CLASSIFICATIONS,
    type AiChatCustomizationSnapshot,
    validateAiChatEditResponse,
} from '@/app/customizing/aiChatEditContract';
import { COLORS } from '@/constants';
import { getAI } from '@/lib/ai/client';
import { normalizeAiRouteError } from '@/lib/ai/routeError';

export const maxDuration = 60;

const APPROVED_COLOR_HEX = COLORS.map(color => color.hex);

const colorSchema = {
    type: Type.STRING,
    enum: APPROVED_COLOR_HEX,
};

const nullableColorSchema = {
    ...colorSchema,
    nullable: true,
};

const topperInputProperties = {
    type: { type: Type.STRING, enum: [...AI_CHAT_MAIN_TOPPER_TYPES] },
    description: { type: Type.STRING },
    size: { type: Type.STRING, enum: [...AI_CHAT_SIZES] },
    quantity: { type: Type.INTEGER },
    groupId: { type: Type.STRING },
    classification: { type: Type.STRING, enum: [...AI_CHAT_TOPPER_CLASSIFICATIONS] },
    material: { type: Type.STRING },
    color: colorSchema,
    colors: { type: Type.ARRAY, items: nullableColorSchema },
    x: { type: Type.NUMBER },
    y: { type: Type.NUMBER },
};

const supportInputProperties = {
    type: { type: Type.STRING, enum: [...AI_CHAT_SUPPORT_ELEMENT_TYPES] },
    description: { type: Type.STRING },
    size: { type: Type.STRING, enum: [...AI_CHAT_SIZES] },
    groupId: { type: Type.STRING },
    material: { type: Type.STRING },
    color: colorSchema,
    colors: { type: Type.ARRAY, items: nullableColorSchema },
    quantity: { type: Type.INTEGER },
    x: { type: Type.NUMBER },
    y: { type: Type.NUMBER },
};

const messageInputProperties = {
    type: { type: Type.STRING, enum: [...AI_CHAT_MESSAGE_TYPES] },
    text: { type: Type.STRING },
    position: { type: Type.STRING, enum: [...AI_CHAT_MESSAGE_POSITIONS] },
    color: colorSchema,
    x: { type: Type.NUMBER },
    y: { type: Type.NUMBER },
};

const buildOperationSchema = (
    inputProperties: Record<string, unknown>,
    addRequired: string[],
) => ({
    type: Type.OBJECT,
    properties: {
        operation: { type: Type.STRING, enum: [...AI_CHAT_OPERATION_TYPES] },
        id: {
            type: Type.STRING,
            description: 'Required for update/remove. Must exactly match one existing stable ID.',
        },
        item: {
            type: Type.OBJECT,
            properties: inputProperties,
            required: addRequired,
        },
        changes: {
            type: Type.OBJECT,
            properties: inputProperties,
        },
    },
    required: ['operation'],
});

const chatEditResponseSchema = {
    type: Type.OBJECT,
    properties: {
        outcome: { type: Type.STRING, enum: [...AI_CHAT_EDIT_OUTCOMES] },
        patch: {
            type: Type.OBJECT,
            properties: {
                cake: {
                    type: Type.OBJECT,
                    properties: {
                        family: { type: Type.STRING, enum: [...AI_CHAT_CAKE_FAMILIES] },
                        thickness: { type: Type.STRING, enum: [...AI_CHAT_CAKE_THICKNESSES] },
                        size: { type: Type.STRING },
                        flavors: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING, enum: [...AI_CHAT_CAKE_FLAVORS] },
                        },
                    },
                },
                icing: {
                    type: Type.OBJECT,
                    properties: {
                        base: { type: Type.STRING, enum: [...AI_CHAT_ICING_BASES] },
                        colorType: { type: Type.STRING, enum: [...AI_CHAT_ICING_COLOR_TYPES] },
                        colors: {
                            type: Type.OBJECT,
                            properties: {
                                side: colorSchema,
                                top: colorSchema,
                                gumpasteBaseBoardColor: colorSchema,
                            },
                        },
                        drip: { type: Type.BOOLEAN },
                        borderTop: { type: Type.BOOLEAN },
                        borderBase: { type: Type.BOOLEAN },
                        gumpasteBaseBoard: { type: Type.BOOLEAN },
                    },
                },
                topperOperations: {
                    type: Type.ARRAY,
                    items: buildOperationSchema(topperInputProperties, [
                        'type',
                        'description',
                        'size',
                        'quantity',
                        'groupId',
                        'classification',
                    ]),
                },
                supportOperations: {
                    type: Type.ARRAY,
                    items: buildOperationSchema(supportInputProperties, [
                        'type',
                        'description',
                        'size',
                        'groupId',
                    ]),
                },
                messageOperations: {
                    type: Type.ARRAY,
                    items: buildOperationSchema(messageInputProperties, [
                        'type',
                        'text',
                        'position',
                        'color',
                    ]),
                },
            },
        },
        actions: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    type: { type: Type.STRING, enum: [...AI_CHAT_ACTION_TYPES] },
                    content: { type: Type.STRING },
                },
                required: ['type'],
            },
        },
        message: { type: Type.STRING },
    },
    required: ['outcome', 'actions'],
};

const systemInstruction = `You translate a customer's cake-edit request into a MINIMAL structured patch. Never return a full cake analysis and never copy unchanged fields into the patch.

Return exactly this top-level JSON contract:
{
  "outcome": "design_change" | "action_only" | "restriction" | "clarification" | "noop",
  "patch"?: { "cake"?, "icing"?, "topperOperations"?, "supportOperations"?, "messageOperations"? },
  "actions": [],
  "message"?: "short customer-facing explanation"
}

OUTCOME RULES
- design_change: at least one requested design change; patch is required. Mixed design changes and actions also use design_change.
- action_only: one or more supported actions and no design change; omit patch.
- restriction: the request violates a rule below; omit patch and provide message.
- clarification: the requested target is missing or ambiguous; omit patch and provide a concise question.
- noop: unsupported conversation or a request that would not change anything; omit patch and return no actions.

CAKE AND ICING
- cake.family is base-neutral and must be one of: ${AI_CHAT_CAKE_FAMILIES.join(', ')}.
- "please change to fondant" means patch.icing.base = "fondant". Do not invent a cake family, size, thickness, flavor, or decoration change. The application deterministically maps the current family to its Fondant cake type and compatible size/thickness.
- "change to soft icing" or "remove fondant" means patch.icing.base = "soft_icing" with the same preservation rule.
- Only set cake.family when the customer explicitly asks to change cake family/tier/shape. Never emit Fondant in cake.family.
- Closed cake thicknesses: ${AI_CHAT_CAKE_THICKNESSES.join(', ')}. Closed flavors: ${AI_CHAT_CAKE_FLAVORS.join(', ')}.
- Cake colors go in patch.icing.colors. "make the cake mint green" sets side and top to #98FF98; preserve unrelated effects.
- Drip, top border, bottom border, and covered base board are patch.icing.drip, borderTop, borderBase, and gumpasteBaseBoard booleans. Never model them as support elements.
- Use a six-digit HEX color from the approved palette. Common mappings: mint #98FF98, navy #000080, pink #FFC0CB, light pink #FFB6C1, gold #FFD700, white #FFFFFF, black #000000.

TARGETED OPERATIONS
- Existing toppers, support elements, and messages have stable IDs in CURRENT CUSTOMIZATION.
- To update/remove an existing item, use {"operation":"update","id":"exact-id","changes":{...}} or {"operation":"remove","id":"exact-id"}.
- Never identify an existing target by array index, description, group ID, text, or a made-up ID. Copy its exact stable ID.
- If the wording could refer to zero or multiple existing items, return clarification with no patch. Never update/remove multiple items as a guess.
- To add an item, use {"operation":"add","item":{...}} with all required fields and no ID.
- Topper types: ${AI_CHAT_MAIN_TOPPER_TYPES.join(', ')}.
- Support types: ${AI_CHAT_SUPPORT_ELEMENT_TYPES.join(', ')}.
- Topper classification rules: printed graphics/photos/characters use printout; solid single-color metallic/glitter toppers use cardstock; physical objects use toy/figurine; handmade animal or character toppers use edible_3d_complex.

MESSAGES
- Message types: ${AI_CHAT_MESSAGE_TYPES.join(', ')}. Positions: ${AI_CHAT_MESSAGE_POSITIONS.join(', ')}.
- "front", "front side", or "face" maps to side; "bottom", "board", or "base" maps to base_board.
- "change the message to Happy Birthday" updates the one unambiguous existing message by its exact ID. If there are zero or multiple messages and the customer did not uniquely identify one, return clarification.
- Adding a new message uses a message add operation, normally type icing_script and color #000000 unless specified.

RESTRICTIONS
- While the cake remains Bento, it only supports Chocolate Cake or Vanilla Cake, thickness 2 in, its fixed size, no base_board message, no bottom border, and no covered base board.
- A Fondant request on a current Bento cake is allowed: emit only patch.icing.base = "fondant". The application will convert it to the default 1 Tier Fondant option, matching the manual control.
- If an enabled edible_photo_top topper exists, the top icing color cannot be changed.
- For a restricted request, return outcome restriction, actions [], a polite message, and no patch.

ACTIONS
- "add to cart", "buy this", or "order this" adds {"type":"add_to_cart"}.
- Delivery/pickup details or special order notes add {"type":"update_instructions","content":"the extracted note"}.
- A request may combine a design patch with actions. Chitchat and unsupported commands are noop.

EXAMPLES
- Current soft-icing 1 Tier + "please change to fondant" -> {"outcome":"design_change","patch":{"icing":{"base":"fondant"}},"actions":[]}.
- Current fondant 2 Tier + "make it soft icing and blue" -> {"outcome":"design_change","patch":{"icing":{"base":"soft_icing","colors":{"side":"#0000FF","top":"#0000FF"}}},"actions":[]}.
- "add gold drip" -> {"outcome":"design_change","patch":{"icing":{"drip":true}},"actions":[]}.
- "change message msg-2 to Happy Birthday" -> a message update using id msg-2 and changes {"text":"Happy Birthday"}.
- "remove the flower" when multiple flower elements exist -> clarification, no patch.
- A forbidden Bento bottom border -> restriction, no patch.
- "add to cart" -> {"outcome":"action_only","actions":[{"type":"add_to_cart"}]}.

Use the reference images only to interpret the requested change. Preserve every unrelated field. Return JSON only.`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isCustomizationSnapshot = (value: unknown): value is AiChatCustomizationSnapshot =>
    isRecord(value)
    && isRecord(value.cakeInfo)
    && isRecord(value.icingDesign)
    && isRecord(value.analysisResult)
    && Array.isArray(value.mainToppers)
    && Array.isArray(value.supportElements)
    && Array.isArray(value.cakeMessages)
    && typeof value.additionalInstructions === 'string';

const getCakeFamily = (cakeType: unknown): string | undefined => {
    if (typeof cakeType !== 'string') return undefined;
    return cakeType.replace(/ Fondant$/, '');
};

const getChangeCategories = (patch: Record<string, unknown> | undefined): string[] => {
    if (!patch) return [];
    const categories: string[] = [];
    if ('cake' in patch) categories.push('cake');
    if ('icing' in patch) categories.push('icing');
    if ('topperOperations' in patch) categories.push('toppers');
    if ('supportOperations' in patch) categories.push('support');
    if ('messageOperations' in patch) categories.push('messages');
    return categories;
};

const stringifyCustomizationForModel = (snapshot: AiChatCustomizationSnapshot): string =>
    JSON.stringify(snapshot, (key, value) => key === 'replacementImage' ? undefined : value, 2);

export async function POST(req: NextRequest) {
    const traceId = req.headers.get('x-ai-trace-id')
        ?? `chat-edit-route-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const startedAt = Date.now();

    try {
        const body: unknown = await req.json();
        if (!isRecord(body)) {
            return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
        }

        const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
        const currentCustomization = body.currentCustomization;
        if (!prompt || !isCustomizationSnapshot(currentCustomization)) {
            return NextResponse.json(
                { error: 'Missing prompt or valid currentCustomization in request body.' },
                { status: 400 },
            );
        }

        const validReferenceImages = Array.isArray(body.referenceImages)
            ? body.referenceImages.filter(reference =>
                isRecord(reference)
                && isRecord(reference.image)
                && typeof reference.image.data === 'string'
                && reference.image.data.length > 0
                && typeof reference.image.mimeType === 'string'
                && reference.image.mimeType.length > 0
            )
            : [];

        const icingBaseBefore = typeof currentCustomization.icingDesign.base === 'string'
            ? currentCustomization.icingDesign.base
            : undefined;
        const cakeFamilyBefore = getCakeFamily(currentCustomization.cakeInfo.type);

        console.log(`[AI TRACE ${traceId}] /api/ai/chat-edit:start`, {
            icingBaseBefore,
            cakeFamilyBefore,
        });

        const parts: Array<
            | { text: string }
            | { inlineData: { data: string; mimeType: string } }
        > = [];

        validReferenceImages.forEach(reference => {
            const image = reference.image as Record<string, unknown>;
            parts.push({
                inlineData: {
                    data: image.data as string,
                    mimeType: image.mimeType as string,
                },
            });
            parts.push({
                text: `${typeof reference.label === 'string' ? reference.label : 'Reference image'} is an additional ${typeof reference.targetType === 'string' ? reference.targetType : 'design reference'} labeled "${typeof reference.targetDescription === 'string' ? reference.targetDescription : 'unnamed reference'}". Use it only to interpret the requested change.`,
            });
        });

        parts.push({
            text: `CUSTOMER REQUEST:\n${prompt}\n\nCURRENT CUSTOMIZATION (stable IDs are authoritative):\n${stringifyCustomizationForModel(currentCustomization)}`,
        });

        const aiClient = getAI(req);
        const response = await aiClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts }],
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: chatEditResponseSchema,
                temperature: 0,
            },
        });

        const jsonText = (response.text || '').trim();
        let parsedResponse: unknown;
        try {
            parsedResponse = JSON.parse(jsonText);
        } catch {
            console.error(`[AI TRACE ${traceId}] /api/ai/chat-edit:invalid-response`, {
                validationKind: 'invalid_json',
                durationMs: Date.now() - startedAt,
            });
            return NextResponse.json(
                { error: 'AI returned an invalid cake design update.' },
                { status: 502 },
            );
        }

        const validation = validateAiChatEditResponse(parsedResponse, {
            mainToppers: currentCustomization.mainToppers,
            supportElements: currentCustomization.supportElements,
            cakeMessages: currentCustomization.cakeMessages,
        });
        if (!validation.success) {
            if (validation.kind === 'ambiguous_target') {
                const clarificationResponse = {
                    outcome: 'clarification' as const,
                    actions: [],
                    message: 'I could not identify exactly one cake detail to change. Please tell me which specific item you mean.',
                };
                console.log(`[AI TRACE ${traceId}] /api/ai/chat-edit:success`, {
                    outcome: clarificationResponse.outcome,
                    actionTypes: [],
                    changeCategories: [],
                    icingBaseBefore,
                    icingBaseRequested: undefined,
                    cakeFamilyBefore,
                    visualRequested: false,
                    durationMs: Date.now() - startedAt,
                });
                return NextResponse.json(clarificationResponse);
            }

            console.error(`[AI TRACE ${traceId}] /api/ai/chat-edit:invalid-response`, {
                validationKind: validation.kind,
                durationMs: Date.now() - startedAt,
            });
            return NextResponse.json(
                { error: 'AI returned an invalid cake design update.' },
                { status: 502 },
            );
        }

        const patch = validation.data.patch as Record<string, unknown> | undefined;
        const icingPatch = isRecord(patch?.icing) ? patch.icing : undefined;
        const actionTypes = [...new Set(validation.data.actions.map(action => action.type))];

        console.log(`[AI TRACE ${traceId}] /api/ai/chat-edit:success`, {
            outcome: validation.data.outcome,
            actionTypes,
            changeCategories: getChangeCategories(patch),
            icingBaseBefore,
            icingBaseRequested: typeof icingPatch?.base === 'string' ? icingPatch.base : undefined,
            cakeFamilyBefore,
            visualRequested: validation.data.outcome === 'design_change',
            durationMs: Date.now() - startedAt,
        });

        return NextResponse.json(validation.data);
    } catch (error: unknown) {
        const normalizedError = normalizeAiRouteError(error, {
            defaultMessage: 'Failed to update cake design. Please try again.',
            quotaMessage: 'AI design updates are temporarily unavailable due to quota limits. Please try again later.',
        });

        console.error(`[AI TRACE ${traceId}] /api/ai/chat-edit:error`, {
            durationMs: Date.now() - startedAt,
            status: normalizedError.status,
            errorName: error instanceof Error ? error.name : 'unknown',
        });

        return NextResponse.json(
            { error: normalizedError.message },
            { status: normalizedError.status },
        );
    }
}
