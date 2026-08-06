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
        visualEdit: { type: Type.BOOLEAN },
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
  "visualEdit"?: true | false,
  "patch"?: { "cake"?, "icing"?, "topperOperations"?, "supportOperations"?, "messageOperations"? },
  "actions": [],
  "message"?: "short customer-facing explanation"
}

OUTCOME RULES
- design_change: at least one requested design change; patch is required unless visualEdit is true for a reference-only rendered-image change. Mixed design changes and actions also use design_change.
- visualEdit: set true when the customer asks to change the rendered cake image using an attached/reference image, even when no structured cake option changes are needed. For a reference-only visual edit, return "outcome": "design_change", "visualEdit": true, omit patch, and preserve every customization field.
- action_only: one or more supported actions and no design change; omit patch.
- restriction: the request violates a rule below; omit patch and provide message.
- clarification: the requested target, change, or required detail is missing, ambiguous, or too vague to apply safely; omit patch and provide an actionable customer-facing message.
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
- An update operation must use "changes", never "item". For example, recolor a topper with {"operation":"update","id":"exact-id","changes":{"color":"#FFC0CB"}}. Never put a color change in patch.icing unless the customer asked to recolor the icing.
- Never identify an existing target by array index, description, group ID, text, or a made-up ID. Copy its exact stable ID.
- For an explicit category-scoped request such as "change all toy toppers to printouts" or "change all edible toppers to printouts", update every enabled main topper whose current OR original type belongs to the named source category, and update no other topper. Use each target's exact stable ID.
 - Toy toppers include current or original type "toy", "figurine", or "plastic_ball". Edible toppers include current or original type "edible_3d_complex", "edible_3d_ordinary", "edible_crown", "edible_2d_complex", "edible_logo_2d", or "edible_2d_shapes"; "edible_flowers" is excluded from printout conversion and must always remain as edible_flowers. An "edible_photo_top" is handled as an edible photo, not as a generic edible topper.
- For a category-scoped request to restore a material (for example, "change all toy toppers to toys" or "change all edible toppers to edible toppers"), use the appropriate original/current source type for each target when it is already known. When converting toys to edible toppers, choose the most visually appropriate edible 3D topper type from the target description and preserve the existing description, size, quantity, placement, and identity.
- "change all the toppers to printout" (or an equivalent all/every request) explicitly means update every enabled main topper to type "printout". Emit one update operation for each existing target using its exact stable ID; do not ask for clarification.
- For a named request such as "change the girl topper to printout", use the current cake design and topper descriptions to find one matching enabled main topper, then emit an update using its exact stable ID. If no single target can be identified, return clarification with no patch.
- If a requested topper is not present on the cake, return clarification with a customer-facing message such as "I can't find a girl topper on this cake to edit." Never invent an ID or return a malformed patch.
- If the wording does not explicitly request all/every items and could refer to zero or multiple existing items, return clarification with no patch. Never update/remove multiple items as a guess.
- To add an item, use {"operation":"add","item":{...}} with all required fields and no ID.
- Topper types: ${AI_CHAT_MAIN_TOPPER_TYPES.join(', ')}.
- Support types: ${AI_CHAT_SUPPORT_ELEMENT_TYPES.join(', ')}.
- Topper classification rules: printed graphics/photos/characters use printout; solid single-color metallic/glitter toppers use cardstock; physical objects use toy/figurine. Handmade detailed character, animal, face, or object artwork that is flat-backed or shallow-relief uses edible_2d_complex. Only handmade edible figures that are freestanding and sculpted with full depth use edible_3d_complex.

MESSAGES
- Message types: ${AI_CHAT_MESSAGE_TYPES.join(', ')}. Positions: ${AI_CHAT_MESSAGE_POSITIONS.join(', ')}.
- "front", "front side", or "face" maps to side; "bottom", "board", or "base" maps to base_board.
- "change the message to Happy Birthday" updates the one unambiguous existing message by its exact ID. If there are zero or multiple messages and the customer did not uniquely identify one, return clarification.
- Adding a new message uses a message add operation, normally type icing_script and color #000000 unless specified.

RESTRICTIONS
- While the cake remains Bento, it only supports Chocolate Cake or Vanilla Cake, thickness 2 in, its fixed size, no base_board message, no bottom border, and no covered base board.
- A Fondant request on a current Bento cake is allowed: emit only patch.icing.base = "fondant". The application will convert it to the default 1 Tier Fondant option, matching the manual control.
- If an enabled edible_photo_top topper exists, the top icing color cannot be changed.
- edible_flowers toppers cannot be converted to printout or any other type. Never emit a type change to "printout" for an edible_flowers target; if the customer asks to convert edible flowers to a printout, return restriction with a polite message.
- For a restricted request, return outcome restriction, actions [], a polite message, and no patch.

ACTIONS
- "add to cart", "buy this", or "order this" adds {"type":"add_to_cart"}.
- Delivery/pickup details or special order notes add {"type":"update_instructions","content":"the extracted note"}.
- A request may combine a design patch with actions. Chitchat and unsupported commands are noop.

WEAK OR UNCLEAR DESIGN REQUESTS
- Do not guess when a customer says "change the cake", "make it nicer", "fix it", "redesign it", or gives another vague design request without naming both the target and the desired change. Return clarification with no patch, no visualEdit, and no actions.
- Make clarification helpful rather than generic: briefly state what detail is missing and give up to three short example prompts that use supported cake controls or an unambiguous item from CURRENT CUSTOMIZATION. Keep the message to one to three sentences.
- Good example clarification: "Tell me what you want to change and where. For example: 'make the icing pink', 'change the Happy Birthday topper to a printout', or 'make the cake 2-tier.'"
- If an attached/reference image is present but the customer does not say what it should replace or change, ask them to name the target. Example: "Tell me what the uploaded image should replace, such as 'replace the edible photo on top with this image.'"
- If a request names a category with multiple possible targets, ask which item or position they mean, such as the top, side, left, right, or a named topper. Do not provide examples that imply a target is present when it is not in CURRENT CUSTOMIZATION.

EXAMPLES
- Current soft-icing 1 Tier + "please change to fondant" -> {"outcome":"design_change","patch":{"icing":{"base":"fondant"}},"actions":[]}.
- Current fondant 2 Tier + "make it soft icing and blue" -> {"outcome":"design_change","patch":{"icing":{"base":"soft_icing","colors":{"side":"#0000FF","top":"#0000FF"}}},"actions":[]}.
- "add gold drip" -> {"outcome":"design_change","patch":{"icing":{"drip":true}},"actions":[]}.
- Current enabled edible_photo_top + an attached image + "Change the Edible Photo to the uploaded photo" -> {"outcome":"design_change","visualEdit":true,"actions":[]}.
- "change message msg-2 to Happy Birthday" -> a message update using id msg-2 and changes {"text":"Happy Birthday"}.
- "remove the flower" when multiple flower elements exist -> clarification, no patch.
- "change the cake" or "make it nicer" without a target and requested change -> clarification with a helpful explanation and concrete examples, no patch.
- A forbidden Bento bottom border -> restriction, no patch.
- "add to cart" -> {"outcome":"action_only","actions":[{"type":"add_to_cart"}]}.

Use attached/reference images to interpret and apply the requested visual change. Do not use them to change unrelated cake elements. Preserve every unrelated field. Return JSON only.`;

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

const getModelResponseShape = (response: unknown) => {
    if (!isRecord(response)) {
        return { responseType: Array.isArray(response) ? 'array' : typeof response };
    }

    return {
        topLevelKeys: Object.keys(response).sort(),
        outcome: typeof response.outcome === 'string' ? response.outcome : undefined,
        visualEdit: typeof response.visualEdit === 'boolean' ? response.visualEdit : undefined,
        hasPatch: 'patch' in response,
        patchKeys: isRecord(response.patch) ? Object.keys(response.patch).sort() : [],
        actionCount: Array.isArray(response.actions) ? response.actions.length : undefined,
        hasMessage: typeof response.message === 'string' && response.message.length > 0,
    };
};

const normalizeModelUpdateOperations = (response: unknown): unknown => {
    if (!isRecord(response) || !isRecord(response.patch)) return response;

    const normalizedPatch: Record<string, unknown> = { ...response.patch };
    let changed = false;

    ['topperOperations', 'supportOperations', 'messageOperations'].forEach(key => {
        const operations = normalizedPatch[key];
        if (!Array.isArray(operations)) return;

        const normalizedOperations = operations.map(operation => {
            if (!isRecord(operation)
                || operation.operation !== 'update'
                || 'changes' in operation
                || !('item' in operation)) {
                return operation;
            }

            const { item, ...updateOperation } = operation;
            changed = true;
            return { ...updateOperation, changes: item };
        });
        normalizedPatch[key] = normalizedOperations;
    });

    return changed ? { ...response, patch: normalizedPatch } : response;
};

const getInvalidModelResponseClarification = (
    errors: string[],
    customization: AiChatCustomizationSnapshot,
) => {
    if (errors.some(error => error.startsWith('patch.topperOperations'))) {
        const hasEnabledTopper = customization.mainToppers.some(topper => topper.isEnabled);
        return {
            outcome: 'clarification' as const,
            actions: [],
            message: hasEnabledTopper
                ? "I couldn't find a matching topper on this cake to edit. Please name the topper you mean."
                : "This cake doesn't have a topper I can edit.",
        };
    }

    if (errors.some(error => error.startsWith('patch.supportOperations'))) {
        return {
            outcome: 'clarification' as const,
            actions: [],
            message: "I couldn't find a matching cake detail to edit. Please name the decoration you mean.",
        };
    }

    if (errors.some(error => error.startsWith('patch.messageOperations'))) {
        return {
            outcome: 'clarification' as const,
            actions: [],
            message: "I couldn't find a matching cake message to edit. Please tell me which message you mean.",
        };
    }

    return {
        outcome: 'clarification' as const,
        actions: [],
        message: "I couldn't apply that cake change. Please describe the item and change in another way.",
    };
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
                text: `${typeof reference.label === 'string' ? reference.label : 'Reference image'} is an additional ${typeof reference.targetType === 'string' ? reference.targetType : 'design reference'} labeled "${typeof reference.targetDescription === 'string' ? reference.targetDescription : 'unnamed reference'}". Use it to interpret and apply the requested visual change only; do not change unrelated cake elements.`,
            });
        });

        parts.push({
            text: `CUSTOMER REQUEST:\n${prompt}\n\nCURRENT CUSTOMIZATION (stable IDs are authoritative):\n${stringifyCustomizationForModel(currentCustomization)}`,
        });

        const aiClient = getAI(req);
        const response = await aiClient.models.generateContent({
            model: 'gemini-3.1-flash-lite',
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
            return NextResponse.json(getInvalidModelResponseClarification([], currentCustomization));
        }

        const validation = validateAiChatEditResponse(normalizeModelUpdateOperations(parsedResponse), {
            mainToppers: currentCustomization.mainToppers,
            supportElements: currentCustomization.supportElements,
            cakeMessages: currentCustomization.cakeMessages,
        });
        if (!validation.success) {
            if (validation.kind === 'ambiguous_target') {
                const clarificationResponse = getInvalidModelResponseClarification(
                    validation.errors,
                    currentCustomization,
                );
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
                validationErrors: validation.errors,
                modelResponseShape: getModelResponseShape(parsedResponse),
                durationMs: Date.now() - startedAt,
            });
            return NextResponse.json(
                getInvalidModelResponseClarification(validation.errors, currentCustomization),
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
            visualRequested: validation.data.visualEdit === true || validation.data.outcome === 'design_change',
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
