import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/auth/guard.js';
import { getGroup, putGroup, deleteGroup, getGroupByCode } from '../../../../lib/storage/index.js';

// Join codes avoid ambiguous characters (0/O, 1/I/L) for reading aloud in a room.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function generateCode() {
    const pick = () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    return `${pick()}${pick()}${pick()}${pick()}-${pick()}${pick()}${pick()}${pick()}`;
}

async function uniqueCode() {
    for (let i = 0; i < 5; i++) {
        const code = generateCode();
        if (!(await getGroupByCode(code))) return code;
    }
    throw new Error('could not generate unique join code');
}

// Create (no id) or update (with id) a group.
export async function POST(req) {
    const gate = await requireAdmin(req);
    if (!gate.ok) return gate.response;
    const body = await req.json().catch(() => ({}));

    const existing = body.id ? await getGroup(body.id) : null;
    if (body.id && !existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const name = (body.name ?? existing?.name ?? '').trim();
    if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 });

    const models = Array.isArray(body.models)
        ? body.models.map(m => String(m).trim()).filter(Boolean)
        : (existing?.models || []);

    const group = {
        id: existing?.id || crypto.randomUUID(),
        name,
        code: body.regenerate_code || !existing ? await uniqueCode() : existing.code,
        valid_from: body.valid_from !== undefined ? (body.valid_from || null) : (existing?.valid_from || null),
        valid_until: body.valid_until !== undefined ? (body.valid_until || null) : (existing?.valid_until || null),
        models,
        runs_per_day: body.runs_per_day !== undefined ? (Number(body.runs_per_day) || 0) : (existing?.runs_per_day || 0),
        created_at: existing?.created_at || new Date().toISOString()
    };
    await putGroup(group);
    return NextResponse.json({ ok: true, group });
}

export async function DELETE(req) {
    const gate = await requireAdmin(req);
    if (!gate.ok) return gate.response;
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });
    await deleteGroup(id);
    return NextResponse.json({ ok: true });
}
