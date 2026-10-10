export const CLIENT_API_ERROR_EVENT = 'genie:client-api-error';

export interface ClientApiErrorReport {
    endpoint: string;
    method: string;
    status: number;
    message: string;
    stack?: string;
}

export function dispatchClientApiErrorReport(report: ClientApiErrorReport): void {
    if (typeof window === 'undefined' || typeof CustomEvent === 'undefined') return;

    window.dispatchEvent(new CustomEvent<ClientApiErrorReport>(CLIENT_API_ERROR_EVENT, {
        detail: report,
    }));
}
