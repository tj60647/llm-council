// Auth feature flag and env access. Auth activates only when all three env
// vars exist; otherwise the app runs in the original open single-user mode.
// This lets the code deploy before the GitHub OAuth app is configured.

export function authEnabled() {
    return Boolean(
        process.env.AUTH_GITHUB_ID &&
        process.env.AUTH_GITHUB_SECRET &&
        process.env.AUTH_SECRET
    );
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

// Identity used when auth is disabled (local dev / pre-configuration deploys).
// Admin so the /admin page remains reachable for setup and local testing.
export const ANONYMOUS = { email: 'local@anonymous', name: 'Local User', login: null, admin: true };
