// Request authorization. Identity comes from the session JWT; authorization
// (enrollment, group validity, entitlements) is read from storage per request
// so admin changes and expiry apply immediately, not at next login.
import { NextResponse } from 'next/server';
import { authEnabled, isAdminEmail, ANONYMOUS } from './config.js';
import { sessionFromRequest } from './session.js';
import { getUser, getGroup, incrRunCount, getRunCount } from '../storage/index.js';

export function todayUTC() {
    return new Date().toISOString().slice(0, 10);
}

function deny(status, error, extra = {}) {
    return { ok: false, response: NextResponse.json({ error, ...extra }, { status }) };
}

// Resolve the caller's auth context without judging it. Returns
// { session, user, group, admin, status } where status is one of:
// 'open' (auth disabled), 'admin', 'active', 'unauthenticated',
// 'not_enrolled', 'revoked', 'not_yet_valid', 'expired', 'group_missing'.
export async function authContext(req) {
    if (!authEnabled()) return { session: ANONYMOUS, user: null, group: null, admin: true, status: 'open' };

    const session = await sessionFromRequest(req);
    if (!session) return { session: null, user: null, group: null, admin: false, status: 'unauthenticated' };

    const admin = isAdminEmail(session.email);
    if (admin) return { session, user: null, group: null, admin: true, status: 'admin' };

    const user = await getUser(session.email);
    if (!user) return { session, user: null, group: null, admin: false, status: 'not_enrolled' };
    if (user.revoked) return { session, user, group: null, admin: false, status: 'revoked' };

    const group = await getGroup(user.group_id);
    if (!group) return { session, user, group: null, admin: false, status: 'group_missing' };

    const now = Date.now();
    if (group.valid_from && now < Date.parse(group.valid_from)) return { session, user, group, admin: false, status: 'not_yet_valid' };
    if (group.valid_until && now > Date.parse(group.valid_until)) return { session, user, group, admin: false, status: 'expired' };

    return { session, user, group, admin: false, status: 'active' };
}

// Gate an API route. Returns { ok: true, ctx } or { ok: false, response }.
export async function requireUser(req) {
    const ctx = await authContext(req);
    switch (ctx.status) {
        case 'open':
        case 'admin':
        case 'active':
            return { ok: true, ctx };
        case 'unauthenticated':
            return deny(401, 'unauthenticated');
        case 'not_enrolled':
        case 'group_missing':
            return deny(403, 'not_enrolled');
        case 'revoked':
            return deny(403, 'revoked');
        case 'not_yet_valid':
            return deny(403, 'not_yet_valid', { valid_from: ctx.group.valid_from });
        case 'expired':
            return deny(403, 'expired', { valid_until: ctx.group.valid_until });
        default:
            return deny(403, 'forbidden');
    }
}

export async function requireAdmin(req) {
    const ctx = await authContext(req);
    if (ctx.status === 'open' || ctx.admin) return { ok: true, ctx };
    if (ctx.status === 'unauthenticated') return deny(401, 'unauthenticated');
    return deny(403, 'admin_only');
}

// null = unrestricted; otherwise a Set of allowed model ids.
export function allowedModelIds(ctx) {
    if (ctx.admin || !ctx.group) return null;
    const models = ctx.group.models;
    return Array.isArray(models) && models.length ? new Set(models) : null;
}

// Validate a requested seat list against entitlements. Returns
// { ok: true, models } or { ok: false, response }.
export function checkSeatModels(requested, ctx) {
    const allowed = allowedModelIds(ctx);
    if (!allowed) return { ok: true, models: requested };
    const rejected = requested.filter(m => !allowed.has(m));
    if (rejected.length) {
        return { ok: false, response: NextResponse.json({ error: 'models_not_allowed', rejected, allowed: [...allowed] }, { status: 403 }) };
    }
    return { ok: true, models: requested };
}

// Consume one council run against the caller's daily cap. Returns
// { ok: true } or { ok: false, response } with 429.
export async function consumeRun(ctx) {
    if (ctx.admin || !ctx.group?.runs_per_day) return { ok: true };
    const email = ctx.session.email;
    const count = await incrRunCount(email, todayUTC());
    if (count > ctx.group.runs_per_day) {
        return { ok: false, response: NextResponse.json({ error: 'run_limit_reached', limit: ctx.group.runs_per_day, used: count - 1 }, { status: 429 }) };
    }
    return { ok: true };
}

export async function runsToday(email) {
    return await getRunCount(email, todayUTC());
}

// Ownership: a conversation is visible to its owner or an admin. Conversations
// created in open mode (owner null) stay visible to everyone in open mode only.
export function ownsConversation(c, ctx) {
    if (ctx.admin) return true;
    return Boolean(c.owner) && c.owner === ctx.session.email;
}
