export const CREATOR_APPLICATION_CLOSED_MESSAGE =
    'We’re already full for the Xdeal Collab Program for September. We’ll open applications again next month for October. You’ll be the first to know when applications open—we’ll message and email you.';

export function areCreatorApplicationsOpen() {
    return process.env.NEXT_PUBLIC_CREATOR_APPLICATIONS_OPEN === 'true';
}
