import { NextResponse } from 'next/server';
import { authEnabled } from '../../../../lib/auth/config.js';
import { authorizeUrl } from '../../../../lib/auth/github.js';
import { stateCookieHeader } from '../../../../lib/auth/session.js';

export async function GET(req) {
    if (!authEnabled()) return NextResponse.redirect(new URL('/', req.url));
    const state = crypto.randomUUID();
    const res = NextResponse.redirect(authorizeUrl(state));
    res.headers.append('Set-Cookie', stateCookieHeader(state));
    return res;
}
