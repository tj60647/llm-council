import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/auth/guard.js';
import { getUser, putUser, deleteUser, getGroup } from '../../../../lib/storage/index.js';

// Add an email to the allowlist by enrolling it into a group directly.
export async function POST(req) {
    const gate = await requireAdmin(req);
    if (!gate.ok) return gate.response;
    const body = await req.json().catch(() => ({}));
    const email = (body.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) return NextResponse.json({ error: 'valid_email_required' }, { status: 400 });
    if (!body.group_id || !(await getGroup(body.group_id))) return NextResponse.json({ error: 'valid_group_required' }, { status: 400 });

    const existing = await getUser(email);
    const user = await putUser({
        email,
        name: existing?.name || null,
        github_login: existing?.github_login || null,
        group_id: body.group_id,
        enrolled_at: existing?.enrolled_at || new Date().toISOString(),
        last_login: existing?.last_login || null,
        revoked: false
    });
    return NextResponse.json({ ok: true, user });
}

// Update revocation or group membership.
export async function PATCH(req) {
    const gate = await requireAdmin(req);
    if (!gate.ok) return gate.response;
    const body = await req.json().catch(() => ({}));
    const user = await getUser(body.email);
    if (!user) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    if (body.revoked !== undefined) user.revoked = Boolean(body.revoked);
    if (body.group_id !== undefined) {
        if (!(await getGroup(body.group_id))) return NextResponse.json({ error: 'valid_group_required' }, { status: 400 });
        user.group_id = body.group_id;
    }
    await putUser(user);
    return NextResponse.json({ ok: true, user });
}

export async function DELETE(req) {
    const gate = await requireAdmin(req);
    if (!gate.ok) return gate.response;
    const email = new URL(req.url).searchParams.get('email');
    if (!email) return NextResponse.json({ error: 'email_required' }, { status: 400 });
    await deleteUser(email);
    return NextResponse.json({ ok: true });
}
