import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/auth/guard.js';
import { getGroupByCode } from '../../../../lib/storage/index.js';
import { generateQrSvg } from '../../../../lib/qr.js';

export const runtime = 'nodejs';

// A join code's QR never changes, so render once per code per instance.
const cache = new Map();

export async function GET(req) {
    const gate = await requireAdmin(req);
    if (!gate.ok) return gate.response;

    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    if (!code) return NextResponse.json({ error: 'code_required' }, { status: 400 });

    // Only ever encode a real group's join link
    const group = await getGroupByCode(code);
    if (!group) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const joinUrl = `${url.origin}/?join=${encodeURIComponent(group.code)}`;
    const key = `${joinUrl}`;
    if (cache.has(key)) return NextResponse.json(cache.get(key));

    try {
        const { svg, source } = await generateQrSvg(joinUrl);
        const payload = { svg, source, url: joinUrl, code: group.code, group: group.name };
        cache.set(key, payload);
        return NextResponse.json(payload);
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
