// GitHub OAuth (authorization code flow, confidential client). No redirect_uri
// is sent — GitHub uses the OAuth app's registered callback URL, so local dev
// and production each use their own OAuth app with matching env vars.
import { githubCreds } from './config.js';

export function authorizeUrl(state) {
    const { clientId } = githubCreds();
    const p = new URLSearchParams({ client_id: clientId, scope: 'read:user user:email', state });
    return `https://github.com/login/oauth/authorize?${p}`;
}

export async function exchangeCodeForUser(code) {
    const { clientId, clientSecret } = githubCreds();
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code })
    });
    if (!tokenRes.ok) throw new Error(`token exchange failed ${tokenRes.status}`);
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error(tokenData.error_description || 'no access token');

    const gh = { headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'Accept': 'application/vnd.github+json' } };
    const userRes = await fetch('https://api.github.com/user', gh);
    if (!userRes.ok) throw new Error(`user fetch failed ${userRes.status}`);
    const user = await userRes.json();

    let email = user.email;
    if (!email) {
        const emailsRes = await fetch('https://api.github.com/user/emails', gh);
        if (emailsRes.ok) {
            const emails = await emailsRes.json();
            const primary = emails.find(e => e.primary && e.verified) || emails.find(e => e.verified);
            email = primary?.email || null;
        }
    }
    if (!email) throw new Error('no verified email on GitHub account');

    return { email: email.toLowerCase(), name: user.name || user.login, login: user.login };
}
