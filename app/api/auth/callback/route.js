import { NextResponse } from 'next/server';
import { authEnabled, isAdminEmail } from '../../../../lib/auth/config.js';
import { exchangeCodeForUser } from '../../../../lib/auth/github.js';
import { createSessionToken, sessionCookieHeader, clearStateCookieHeader, parseCookies, STATE_COOKIE } from '../../../../lib/auth/session.js';
import { getUser, putUser } from '../../../../lib/storage/index.js';

export const runtime = 'nodejs';

function redirectHome(req, params = '') {
    return NextResponse.redirect(new URL('/' + params, req.url));
}

export async function GET(req) {
    if (!authEnabled()) return redirectHome(req);
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const cookieState = parseCookies(req)[STATE_COOKIE];

    if (!code || !state || !cookieState || state !== cookieState) {
        return redirectHome(req, '?auth_error=state_mismatch');
    }

    try {
        const gh = await exchangeCodeForUser(code);
        const admin = isAdminEmail(gh.email);
        const token = await createSessionToken({ email: gh.email, name: gh.name, login: gh.login, admin });

        // Track last login on existing enrollment records (not required for access)
        const existing = await getUser(gh.email);
        if (existing) {
            await putUser({ ...existing, name: gh.name, github_login: gh.login, last_login: new Date().toISOString() });
        }

        const res = redirectHome(req);
        res.headers.append('Set-Cookie', sessionCookieHeader(token));
        res.headers.append('Set-Cookie', clearStateCookieHeader());
        return res;
    } catch (e) {
        console.error('[auth/callback]', e.message);
        return redirectHome(req, '?auth_error=oauth_failed');
    }
}
