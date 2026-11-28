// Auth feature flag and env access. Auth activates only when all three env
// vars exist; otherwise local development runs in the original open
// single-user mode. Production never runs open: see authMisconfigured().

export function authEnabled() {
    return Boolean(
        process.env.AUTH_GITHUB_ID &&
        process.env.AUTH_GITHUB_SECRET &&
        process.env.AUTH_SECRET
    );
}

// True when a production build is missing a sign-in setting. The guard then
// refuses every request (503) instead of treating visitors as admin.
// NODE_ENV is 'production' under `next build`/`next start` and on every Vercel
// deployment, previews included; `next dev` runs 'development'.
export function authMisconfigured() {
    return !authEnabled() && process.env.NODE_ENV === 'production';
}

export function githubCreds() {
    return { clientId: process.env.AUTH_GITHUB_ID, clientSecret: process.env.AUTH_GITHUB_SECRET };
}

export function adminEmails() {
    return (process.env.ADMIN_EMAILS || '')
        .split(',')
        .map(e => e.trim().toLowerCase())
        .filter(Boolean);
}

export function isAdminEmail(email) {
    return Boolean(email) && adminEmails().includes(email.toLowerCase());
}

// Identity used when auth is disabled (local development only).
// Admin so the /admin page remains reachable for setup and local testing.
export const ANONYMOUS = { email: 'local@anonymous', name: 'Local User', login: null, admin: true };
