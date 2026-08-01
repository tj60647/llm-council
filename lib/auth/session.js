// Session cookies: HMAC-signed JWTs via jose. The JWT carries identity only
// (email/name/login/admin); group membership and entitlements are read live
// from storage on every request so admin edits take effect immediately.
import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'council_session';
export const STATE_COOKIE = 'council_oauth_state';
const SESSION_TTL_S = 7 * 24 * 60 * 60; // 7 days

function secretKey() {
    return new TextEncoder().encode(process.env.AUTH_SECRET);
}

export async function createSessionToken({ email, name, login, admin }) {
    return await new SignJWT({ name, login, adm: Boolean(admin) })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(email.toLowerCase())
        .setIssuedAt()
        .setExpirationTime(`${SESSION_TTL_S}s`)
        .sign(secretKey());
}

export async function verifySessionToken(token) {
    try {
        const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
        return { email: payload.sub, name: payload.name || null, login: payload.login || null, admin: Boolean(payload.adm) };
    } catch {
        return null;
    }
}

export function parseCookies(req) {
    const header = req?.headers?.get?.('cookie') || '';
    const out = {};
    for (const part of header.split(';')) {
        const i = part.indexOf('=');
        if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    }
    return out;
}

export async function sessionFromRequest(req) {
    const token = parseCookies(req)[SESSION_COOKIE];
    if (!token) return null;
    return await verifySessionToken(token);
}

export function sessionCookieHeader(token) {
    const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
    return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=${SESSION_TTL_S}`;
}

export function clearSessionCookieHeader() {
    return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function stateCookieHeader(state) {
    const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
    return `${STATE_COOKIE}=${state}; Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=600`;
}

export function clearStateCookieHeader() {
    return `${STATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
