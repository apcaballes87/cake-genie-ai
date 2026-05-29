import { describe, expect, it } from 'vitest';
import { parseBackfillCliArgs } from '../backfillCliArgs';

describe('backfillCliArgs parser', () => {
    it('returns default argument values when no parameters are provided', () => {
        const parsed = parseBackfillCliArgs([]);
        expect(parsed).toEqual({
            dryRun: false,
            batchSize: 25,
            status: 'null',
        });
    });

    it('parses --dry-run flag correctly', () => {
        const parsed = parseBackfillCliArgs(['--dry-run']);
        expect(parsed.dryRun).toBe(true);
    });

    it('parses valid --limit values', () => {
        const parsed = parseBackfillCliArgs(['--limit=100']);
        expect(parsed.limit).toBe(100);
    });

    it('rejects invalid --limit values', () => {
        // Negative number
        expect(() => parseBackfillCliArgs(['--limit=-10'])).toThrow(
            'Invalid --limit: must be a positive integer, got "-10"'
        );

        // Zero
        expect(() => parseBackfillCliArgs(['--limit=0'])).toThrow(
            'Invalid --limit: must be a positive integer, got "0"'
        );

        // Decimal / non-integer
        expect(() => parseBackfillCliArgs(['--limit=12.5'])).toThrow(
            'Invalid --limit: must be a positive integer, got "12.5"'
        );

        // Non-numeric text
        expect(() => parseBackfillCliArgs(['--limit=abc'])).toThrow(
            'Invalid --limit: must be a positive integer, got "abc"'
        );
    });

    it('parses valid --batch-size values', () => {
        const parsed = parseBackfillCliArgs(['--batch-size=50']);
        expect(parsed.batchSize).toBe(50);
    });

    it('rejects invalid --batch-size values', () => {
        // Negative number
        expect(() => parseBackfillCliArgs(['--batch-size=-5'])).toThrow(
            'Invalid --batch-size: must be a positive integer, got "-5"'
        );

        // Zero
        expect(() => parseBackfillCliArgs(['--batch-size=0'])).toThrow(
            'Invalid --batch-size: must be a positive integer, got "0"'
        );

        // Decimal / non-integer
        expect(() => parseBackfillCliArgs(['--batch-size=4.2'])).toThrow(
            'Invalid --batch-size: must be a positive integer, got "4.2"'
        );

        // Non-numeric text
        expect(() => parseBackfillCliArgs(['--batch-size=foo'])).toThrow(
            'Invalid --batch-size: must be a positive integer, got "foo"'
        );
    });

    it('parses valid --from-id values', () => {
        const parsed = parseBackfillCliArgs(['--from-id=abc-123-uuid']);
        expect(parsed.fromId).toBe('abc-123-uuid');
    });

    it('rejects empty --from-id values', () => {
        expect(() => parseBackfillCliArgs(['--from-id='])).toThrow(
            'Invalid --from-id: must be a non-empty string'
        );
        expect(() => parseBackfillCliArgs(['--from-id=   '])).toThrow(
            'Invalid --from-id: must be a non-empty string'
        );
    });

    it('parses valid --status values', () => {
        expect(parseBackfillCliArgs(['--status=failed']).status).toBe('failed');
        expect(parseBackfillCliArgs(['--status=partial']).status).toBe('partial');
        expect(parseBackfillCliArgs(['--status=skipped']).status).toBe('skipped');
        expect(parseBackfillCliArgs(['--status=null']).status).toBe('null');
    });

    it('rejects invalid --status values', () => {
        expect(() => parseBackfillCliArgs(['--status=invalid'])).toThrow(
            'Invalid --status: must be one of [failed, partial, skipped, null], got "invalid"'
        );
        expect(() => parseBackfillCliArgs(['--status=ready'])).toThrow(
            'Invalid --status: must be one of [failed, partial, skipped, null], got "ready"'
        );
    });

    it('rejects unknown arguments starting with double dashes', () => {
        expect(() => parseBackfillCliArgs(['--some-unknown-arg'])).toThrow(
            'Unknown argument: --some-unknown-arg'
        );
    });
});
