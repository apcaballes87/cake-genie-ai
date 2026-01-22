// src/lib/utils/validateAnalysis.ts
// Validation layer for AI analysis output before pricing
// Only runs when FEATURE_FLAGS.USE_NEW_PRICING_SYSTEM is enabled

import {
    MAIN_TOPPER_TYPES,
    SUPPORT_ELEMENT_TYPES,
    VALID_SIZES,
    SUBTYPES_BY_TYPE,
    CAKE_MESSAGE_TYPES,
    isValidMainTopperType,
    isValidSupportElementType,
    isValidSize,
    getValidSubtypesForType,
} from '@/constants/pricingEnums';
import { createLogger } from './logger';
const logger = createLogger('PricingValidation');
import type { MainTopperUI, SupportElementUI, CakeMessageUI } from '@/types';

/**
 * Validation error with field path and context
 */
interface ValidationIssue {
    field: string;
    value: string | undefined;
    message: string;
    suggestion?: string;
}

/**
 * Result of validation - includes both blocking errors and non-blocking warnings
 */
interface ValidationResult {
    isValid: boolean;
    errors: ValidationIssue[];   // Blocking issues (type not found)
    warnings: ValidationIssue[]; // Non-blocking issues (size mismatch)
}

/**
 * Input structure for validation (matches pricing service input)
 */
interface ValidationInput {
    mainToppers: MainTopperUI[];
    supportElements: SupportElementUI[];
    cakeMessages?: CakeMessageUI[];
}

/**
 * Validates AI analysis output against the pricing enums
 * 
 * This catches mismatches between:
 * 1. AI output types and pricingEnums.ts
 * 2. AI output sizes and valid size values
 * 3. AI output subtypes and valid subtypes for their parent type
 * 
 * @param input - The UI state to validate
 * @returns ValidationResult with errors and warnings
 */
export function validateAnalysis(input: ValidationInput): ValidationResult {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];

    // Validate main toppers
    input.mainToppers?.forEach((topper, index) => {
        const fieldPrefix = `main_toppers[${index}]`;

        // Check type
        if (!isValidMainTopperType(topper.type)) {
            errors.push({
                field: `${fieldPrefix}.type`,
                value: topper.type,
                message: `Invalid main topper type "${topper.type}"`,
                suggestion: `Valid types: ${MAIN_TOPPER_TYPES.slice(0, 5).join(', ')}...`,
            });
        }

        // Check size
        if (topper.size && !isValidSize(topper.size) && topper.size !== 'mixed') {
            warnings.push({
                field: `${fieldPrefix}.size`,
                value: topper.size,
                message: `Invalid size "${topper.size}" for ${topper.type}`,
                suggestion: `Valid sizes: ${VALID_SIZES.join(', ')}`,
            });
        }

        // Check subtype if present
        if (topper.subtype) {
            const validSubtypes = getValidSubtypesForType(topper.type);
            if (validSubtypes.length > 0 && !validSubtypes.includes(topper.subtype)) {
                warnings.push({
                    field: `${fieldPrefix}.subtype`,
                    value: topper.subtype,
                    message: `Invalid subtype "${topper.subtype}" for type "${topper.type}"`,
                    suggestion: `Valid subtypes: ${validSubtypes.join(', ')}`,
                });
            }
        }
    });

    // Validate support elements
    input.supportElements?.forEach((element, index) => {
        const fieldPrefix = `support_elements[${index}]`;

        // Check type
        if (!isValidSupportElementType(element.type)) {
            errors.push({
                field: `${fieldPrefix}.type`,
                value: element.type,
                message: `Invalid support element type "${element.type}"`,
                suggestion: `Valid types: ${SUPPORT_ELEMENT_TYPES.slice(0, 5).join(', ')}...`,
            });
        }

        // Check size (treat coverage as size for backward compatibility)
        const effectiveSize = element.size || (element as any).coverage;
        if (effectiveSize && !isValidSize(effectiveSize) && effectiveSize !== 'mixed') {
            warnings.push({
                field: `${fieldPrefix}.size`,
                value: effectiveSize,
                message: `Invalid size "${effectiveSize}" for ${element.type}`,
                suggestion: `Valid sizes: ${VALID_SIZES.join(', ')}`,
            });
        }

        // Check subtype if present
        if (element.subtype) {
            const validSubtypes = getValidSubtypesForType(element.type);
            if (validSubtypes.length > 0 && !validSubtypes.includes(element.subtype)) {
                warnings.push({
                    field: `${fieldPrefix}.subtype`,
                    value: element.subtype,
                    message: `Invalid subtype "${element.subtype}" for type "${element.type}"`,
                    suggestion: `Valid subtypes: ${validSubtypes.join(', ')}`,
                });
            }
        }
    });

    // Validate cake messages
    input.cakeMessages?.forEach((message, index) => {
        const fieldPrefix = `cake_messages[${index}]`;

        if (!CAKE_MESSAGE_TYPES.includes(message.type as any)) {
            warnings.push({
                field: `${fieldPrefix}.type`,
                value: message.type,
                message: `Invalid message type "${message.type}"`,
                suggestion: `Valid types: ${CAKE_MESSAGE_TYPES.join(', ')}`,
            });
        }
    });

    // Log issues if any found
    if (errors.length > 0 || warnings.length > 0) {
        logger.warn('Analysis validation issues detected', {
            errorCount: errors.length,
            warningCount: warnings.length,
            errors: errors.map(e => `${e.field}: ${e.value}`),
            warnings: warnings.map(w => `${w.field}: ${w.value}`),
        });
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
    };
}

/**
 * Type guard to check if validation passed
 */
export function isValidationPassed(result: ValidationResult): boolean {
    return result.isValid;
}
