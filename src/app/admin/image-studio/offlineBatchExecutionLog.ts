export type OfflineBatchRunSnapshot = {
  id: string;
  stage: 'studio' | 'mask' | 'complete';
  status: string;
  total_requests: number;
  completed_requests: number;
  failed_requests: number;
};

export type OfflineBatchContinuationResult = {
  imported?: number;
  remaining?: number;
};

export type OfflineBatchExecutionLogEntry = {
  id: string;
  runId: string;
  timestamp: string;
  level: 'info' | 'success' | 'error';
  message: string;
};

type TransitionOptions = {
  prevRun?: OfflineBatchRunSnapshot | null;
  nextRun: OfflineBatchRunSnapshot;
  result?: OfflineBatchContinuationResult;
  timestamp: string;
  source?: 'load' | 'submit' | 'refresh' | 'poll';
};

function makeLogEntry(
  runId: string,
  timestamp: string,
  level: OfflineBatchExecutionLogEntry['level'],
  message: string
): OfflineBatchExecutionLogEntry {
  return {
    id: `${runId}:${timestamp}:${level}:${message}`,
    runId,
    timestamp,
    level,
    message,
  };
}

function pluralize(value: number, noun: string) {
  return `${value} ${noun}${value === 1 ? '' : 's'}`;
}

export function createOfflineBatchLogEntry(
  runId: string,
  level: OfflineBatchExecutionLogEntry['level'],
  message: string,
  timestamp = new Date().toISOString()
) {
  return makeLogEntry(runId, timestamp, level, message);
}

export function buildOfflineBatchTransitionLogEntries({
  prevRun,
  nextRun,
  result,
  timestamp,
  source = 'poll',
}: TransitionOptions): OfflineBatchExecutionLogEntry[] {
  const entries: OfflineBatchExecutionLogEntry[] = [];

  if (!prevRun || prevRun.id !== nextRun.id) {
    if (source === 'submit') {
      entries.push(
        makeLogEntry(
          nextRun.id,
          timestamp,
          'info',
          `Submitted ${nextRun.stage} batch for ${pluralize(nextRun.total_requests, 'cache row')}.`
        )
      );
    } else {
      entries.push(
        makeLogEntry(
          nextRun.id,
          timestamp,
          'info',
          `Loaded active batch: ${nextRun.stage} / ${nextRun.status}. ${nextRun.completed_requests} completed, ${nextRun.failed_requests} failed.`
        )
      );
    }
    return entries;
  }

  if (prevRun.stage !== nextRun.stage) {
    if (nextRun.stage === 'mask') {
      entries.push(
        makeLogEntry(
          nextRun.id,
          timestamp,
          'success',
          `Studio stage finished. Submitted mask stage with ${pluralize(nextRun.completed_requests, 'ready image')}.`
        )
      );
    } else if (nextRun.stage === 'complete') {
      entries.push(
        makeLogEntry(
          nextRun.id,
          timestamp,
          nextRun.status === 'completed' ? 'success' : 'error',
          nextRun.status === 'completed'
            ? `Batch finished successfully. ${nextRun.completed_requests} completed, ${nextRun.failed_requests} failed.`
            : `Batch finished with errors. ${nextRun.completed_requests} completed, ${nextRun.failed_requests} failed.`
        )
      );
    }
  }

  if (prevRun.status !== nextRun.status) {
    if (nextRun.status === 'importing') {
      entries.push(
        makeLogEntry(nextRun.id, timestamp, 'info', `Importing ${nextRun.stage} outputs into Genie.ph storage and database.`)
      );
    } else if (nextRun.status.startsWith('JOB_STATE_')) {
      entries.push(
        makeLogEntry(nextRun.id, timestamp, 'info', `Vertex provider status is now ${nextRun.status}.`)
      );
    } else if (nextRun.status === 'completed' && nextRun.stage === 'complete') {
      entries.push(
        makeLogEntry(nextRun.id, timestamp, 'success', 'Batch marked complete.')
      );
    } else if (nextRun.status === 'completed_with_errors' && nextRun.stage === 'complete') {
      entries.push(
        makeLogEntry(nextRun.id, timestamp, 'error', 'Batch marked complete with errors.')
      );
    }
  }

  if (result?.imported && result.imported > 0) {
    entries.push(
      makeLogEntry(
        nextRun.id,
        timestamp,
        'info',
        `Imported ${pluralize(result.imported, nextRun.stage === 'mask' ? 'mask result' : 'studio result')}. ${nextRun.completed_requests} completed total, ${nextRun.failed_requests} failed, ${result.remaining ?? 0} remaining in this stage.`
      )
    );
  } else if (
    nextRun.completed_requests !== prevRun.completed_requests ||
    nextRun.failed_requests !== prevRun.failed_requests
  ) {
    const deltaCompleted = nextRun.completed_requests - prevRun.completed_requests;
    const deltaFailed = nextRun.failed_requests - prevRun.failed_requests;
    const deltaParts = [
      deltaCompleted > 0 ? `${pluralize(deltaCompleted, 'completed item')}` : null,
      deltaFailed > 0 ? `${pluralize(deltaFailed, 'failed item')}` : null,
    ].filter(Boolean);

    if (deltaParts.length > 0) {
      entries.push(
        makeLogEntry(
          nextRun.id,
          timestamp,
          deltaFailed > 0 ? 'error' : 'info',
          `Progress update: ${deltaParts.join(', ')}. Totals are now ${nextRun.completed_requests} completed and ${nextRun.failed_requests} failed.`
        )
      );
    }
  }

  return entries;
}
