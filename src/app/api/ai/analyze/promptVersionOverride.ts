export function getDevelopmentPromptVersionOverride(): string | undefined {
    if (process.env.NODE_ENV !== 'development') return undefined;
    const version = process.env.CAKE_ANALYSIS_PROMPT_VERSION?.trim();
    return version || undefined;
}
