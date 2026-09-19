/**
 * Verbose cake-analysis traces are deliberately limited to local development.
 * They make the complete model and application-owned geometry flow inspectable
 * in the terminal and browser DevTools without logging customer image bytes.
 */
export function isCakeAnalysisDebugEnabled() {
  return process.env.NODE_ENV === 'development';
}

export function logCakeAnalysisDebug(stage: string, details: Record<string, unknown>) {
  if (!isCakeAnalysisDebugEnabled()) return;

  const label = `[Cake analysis] ${stage}`;
  if (typeof console.groupCollapsed === 'function') {
    console.groupCollapsed(label);
    console.log(details);
    console.groupEnd();
    return;
  }

  console.log(label, details);
}
