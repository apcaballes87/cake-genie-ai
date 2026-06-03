import { describe, expect, it } from 'vitest';

import {
  buildOfflineBatchTransitionLogEntries,
  createOfflineBatchLogEntry,
  type OfflineBatchRunSnapshot,
} from './offlineBatchExecutionLog';

const baseRun: OfflineBatchRunSnapshot = {
  id: 'run-1',
  stage: 'studio',
  status: 'submitted',
  total_requests: 100,
  completed_requests: 0,
  failed_requests: 0,
};

describe('offlineBatchExecutionLog', () => {
  it('logs initial submission', () => {
    const entries = buildOfflineBatchTransitionLogEntries({
      nextRun: baseRun,
      timestamp: '2026-06-03T00:00:00.000Z',
      source: 'submit',
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.message).toContain('Submitted studio batch for 100 cache rows.');
  });

  it('logs import progress from reconcile results', () => {
    const entries = buildOfflineBatchTransitionLogEntries({
      prevRun: baseRun,
      nextRun: {
        ...baseRun,
        status: 'importing',
        completed_requests: 10,
      },
      result: { imported: 10, remaining: 90 },
      timestamp: '2026-06-03T00:00:00.000Z',
      source: 'refresh',
    });

    expect(entries.map((entry) => entry.message)).toEqual([
      'Importing studio outputs into Genie.ph storage and database.',
      'Imported 10 studio results. 10 completed total, 0 failed, 90 remaining in this stage.',
    ]);
  });

  it('logs stage transition into mask submission', () => {
    const entries = buildOfflineBatchTransitionLogEntries({
      prevRun: {
        ...baseRun,
        status: 'importing',
        completed_requests: 100,
      },
      nextRun: {
        ...baseRun,
        stage: 'mask',
        status: 'submitted',
        completed_requests: 100,
      },
      timestamp: '2026-06-03T00:00:00.000Z',
      source: 'poll',
    });

    expect(entries[0]?.message).toContain('Studio stage finished. Submitted mask stage');
  });

  it('creates a standalone error log entry', () => {
    const entry = createOfflineBatchLogEntry('run-1', 'error', 'Continuation paused.');

    expect(entry.runId).toBe('run-1');
    expect(entry.level).toBe('error');
    expect(entry.message).toBe('Continuation paused.');
  });
});
