import { NextResponse } from 'next/server';
import { authEnabled } from '../../../../lib/auth/config.js';
import { authContext, runsToday } from '../../../../lib/auth/guard.js';

// Status endpoint for the client: always 200, states expressed in the body so
// the UI can route between login / enroll / blocked / app screens.
export async function GET(req) {
    const ctx = await authContext(req);
    const body = {
        auth_enabled: authEnabled(),
        status: ctx.status,
        email: ctx.session?.email || null,
        name: ctx.session?.name || null,
        admin: ctx.admin
    };
    if (ctx.group) {
        body.group = {
            name: ctx.group.name,
            valid_from: ctx.group.valid_from,
            valid_until: ctx.group.valid_until,
            models: ctx.group.models || [],
            runs_per_day: ctx.group.runs_per_day || 0
        };
        if (ctx.status === 'active' && ctx.group.runs_per_day) {
            body.runs_today = await runsToday(ctx.session.email);
        }
    }
    return NextResponse.json(body);
}
