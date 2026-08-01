import { NextResponse } from 'next/server';
import { authEnabled } from '../../../../lib/auth/config.js';
import { sessionFromRequest } from '../../../../lib/auth/session.js';
import { getUser, putUser, getGroupByCode } from '../../../../lib/storage/index.js';

// Join a group with its code. Requires an authenticated session (GitHub done)
// but not enrollment — this IS the enrollment step. A valid code moves an
// already-enrolled user to that group; revoked users stay revoked.
export async function POST(req) {
    if (!authEnabled()) return NextResponse.json({ error: 'auth_disabled' }, { status: 400 });
    const session = await sessionFromRequest(req);
    if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const code = (body.code || '').trim();
    if (!code) return NextResponse.json({ error: 'code_required' }, { status: 400 });

    const group = await getGroupByCode(code);
    if (!group) return NextResponse.json({ error: 'invalid_code' }, { status: 404 });

    const now = Date.now();
    if (group.valid_from && now < Date.parse(group.valid_from)) {
        return NextResponse.json({ error: 'not_yet_valid', valid_from: group.valid_from }, { status: 403 });
    }
    if (group.valid_until && now > Date.parse(group.valid_until)) {
        return NextResponse.json({ error: 'expired', valid_until: group.valid_until }, { status: 403 });
    }

    const existing = await getUser(session.email);
    if (existing?.revoked) return NextResponse.json({ error: 'revoked' }, { status: 403 });

    const user = await putUser({
        email: session.email,
        name: session.name,
        github_login: session.login,
        group_id: group.id,
        enrolled_at: existing?.enrolled_at || new Date().toISOString(),
        last_login: new Date().toISOString()
    });
    return NextResponse.json({ ok: true, group: { id: group.id, name: group.name }, user: { email: user.email } });
}
