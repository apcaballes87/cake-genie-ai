/**
 * CLI Argument Parser for the Cake Image Variant Backfill Pipeline.
 * 
 * Provides type-safe parsing and validation of arguments passed to the CLI backfill
 * runner. Isolated as a pure module to allow complete unit testing coverage
 * without executing CLI logic or triggering database/network side effects.
 * 
 * Spec: .kiro/specs/cake-image-variant-pipeline/requirements.md (Req 7.9, 7.10)
 */

export interface BackfillCliArgs {
    /** Cap on the maximum number of rows to process in this run. */
    limit?: number;
    /** Whether the run is a dry-run (no DB updates or storage uploads). */
    dryRun: boolean;
    /** Number of rows to fetch and process in each batch. */
    batchSize: number;
    /** The starting UUID / p_hash to paginate from. */
    fromId?: string;
    /** Filter rows by their current pipeline status. 'null' represents all eligible. */
    status: 'failed' | 'partial' | 'skipped' | 'null';
}

/**
 * Parses raw command-line arguments into a structured, validated config object.
 * Throws a descriptive error when any argument is invalid, malformed, or unrecognized.
 * 
 * @param argv Raw process arguments, usually sliced from process.argv (i.e. process.argv.slice(2))
 */
export const parseBackfillCliArgs = (argv: string[]): BackfillCliArgs => {
    // Standard default options as specified by Phase 7 specs.
    const args: BackfillCliArgs = {
        dryRun: false,
        batchSize: 25,
        status: 'null',
    };

    for (const arg of argv) {
        if (arg === '--dry-run') {
            args.dryRun = true;
            continue;
        }

        if (arg.startsWith('--limit=')) {
            const valStr = arg.split('=')[1];
            const val = Number(valStr);

            // Cap count must be a positive non-zero integer.
            if (Number.isNaN(val) || !Number.isInteger(val) || val <= 0) {
                throw new Error(`Invalid --limit: must be a positive integer, got "${valStr}"`);
            }
            args.limit = val;
            continue;
        }

        if (arg.startsWith('--batch-size=')) {
            const valStr = arg.split('=')[1];
            const val = Number(valStr);

            // Batch size must be a positive non-zero integer to ensure forward progress.
            if (Number.isNaN(val) || !Number.isInteger(val) || val <= 0) {
                throw new Error(`Invalid --batch-size: must be a positive integer, got "${valStr}"`);
            }
            args.batchSize = val;
            continue;
        }

        if (arg.startsWith('--from-id=')) {
            const valStr = arg.split('=')[1];

            // Target p_hash cursor must not be empty or blank space.
            if (!valStr || valStr.trim() === '') {
                throw new Error('Invalid --from-id: must be a non-empty string');
            }
            args.fromId = valStr.trim();
            continue;
        }

        if (arg.startsWith('--status=')) {
            const valStr = arg.split('=')[1];
            const allowedStatuses = ['failed', 'partial', 'skipped', 'null'];

            if (!allowedStatuses.includes(valStr)) {
                throw new Error(
                    `Invalid --status: must be one of [failed, partial, skipped, null], got "${valStr}"`
                );
            }
            args.status = valStr as BackfillCliArgs['status'];
            continue;
        }

        // Catch typos or unsupported parameters to prevent unexpected execution behavior.
        if (arg.startsWith('--')) {
            throw new Error(`Unknown argument: ${arg}`);
        }
    }

    return args;
};
