import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET as getConversations, POST as createConversation } from '../../app/api/conversations/route.js';
import { GET as getConversation } from '../../app/api/conversations/[id]/route.js';
import { POST as postMessage } from '../../app/api/conversations/[id]/message/route.js';
import { GET as getMe } from '../../app/api/auth/me/route.js';
import { POST as enroll } from '../../app/api/auth/enroll/route.js';
import { POST as adminGroups } from '../../app/api/admin/groups/route.js';
import { GET as adminOverview } from '../../app/api/admin/overview/route.js';
import { createSessionToken } from '../../lib/auth/session.js';
import { resetMemory, putGroup, putUser } from '../../lib/storage/memory.js';

vi.mock('../../lib/storage/index.js', async () => {
    const memory = await vi.importActual('../../lib/storage/memory.js');
    return {
        ...memory,
        adapterName: () => 'memory-mock'
    };
});

const HOUR = 3600 * 1000;
const past = (h) => new Date(Date.now() - h * HOUR).toISOString();
const future = (h) => new Date(Date.now() + h * HOUR).toISOString();

function enableAuth() {
    vi.stubEnv('AUTH_GITHUB_ID', 'test-client');
    vi.stubEnv('AUTH_GITHUB_SECRET', 'test-secret');
    vi.stubEnv('AUTH_SECRET', 'unit-test-signing-secret-0123456789');
    vi.stubEnv('ADMIN_EMAILS', 'admin@test.dev');
}

async function reqAs(email, { body, admin = false } = {}) {
    const token = await createSessionToken({ email, name: 'Test', login: 'tester', admin });
    return {
        headers: new Headers({ cookie: `council_session=${token}` }),
        json: async () => body || {},
        url: `http://test.local/api/x`
    };
}

function anonReq(body) {
    return { headers: new Headers(), json: async () => body || {}, url: 'http://test.local/api/x' };
}

const routeProps = (params) => ({ params: Promise.resolve(params) });

const WORKSHOP = {
    id: 'g-workshop',
    name: 'Test Workshop',
    code: 'TEST-CODE',
    valid_from: past(1),
    valid_until: future(24),
    models: ['model-a', 'model-b'],
    runs_per_day: 2,
    created_at: past(2)
};

describe('auth', () => {
    beforeEach(() => {
        resetMemory();
        enableAuth();
    });
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    it('runs open when auth env vars are absent', async () => {
        vi.unstubAllEnvs();
        const me = await (await getMe(anonReq())).json();
        expect(me.auth_enabled).toBe(false);
        expect(me.status).toBe('open');
        const res = await getConversations(anonReq());
        expect(res.status).toBe(200);
    });

    it('rejects unauthenticated API calls when auth is on', async () => {
        const res = await getConversations(anonReq());
        expect(res.status).toBe(401);
        const me = await (await getMe(anonReq())).json();
        expect(me.status).toBe('unauthenticated');
    });

    it('reports not_enrolled for a signed-in user with no group', async () => {
        const me = await (await getMe(await reqAs('alice@test.dev'))).json();
        expect(me.status).toBe('not_enrolled');
        const res = await getConversations(await reqAs('alice@test.dev'));
        expect(res.status).toBe(403);
        expect((await res.json()).error).toBe('not_enrolled');
    });

    it('enrolls via join code (case-insensitive) and activates access', async () => {
        putGroup(WORKSHOP);
        const res = await enroll(await reqAs('alice@test.dev', { body: { code: 'test-code' } }));
        expect(res.status).toBe(200);
        const me = await (await getMe(await reqAs('alice@test.dev'))).json();
        expect(me.status).toBe('active');
        expect(me.group.name).toBe('Test Workshop');
    });

    it('rejects invalid and expired join codes', async () => {
        putGroup({ ...WORKSHOP, id: 'g-old', code: 'OLD-CODE', valid_until: past(1) });
        const bad = await enroll(await reqAs('alice@test.dev', { body: { code: 'NOPE-NOPE' } }));
        expect(bad.status).toBe(404);
        const expired = await enroll(await reqAs('alice@test.dev', { body: { code: 'OLD-CODE' } }));
        expect(expired.status).toBe(403);
        expect((await expired.json()).error).toBe('expired');
    });

    it('blocks access outside the group validity window', async () => {
        putGroup({ ...WORKSHOP, valid_until: past(1) });
        putUser({ email: 'alice@test.dev', group_id: WORKSHOP.id, enrolled_at: past(2) });
        const res = await getConversations(await reqAs('alice@test.dev'));
        expect(res.status).toBe(403);
        expect((await res.json()).error).toBe('expired');
    });

    it('blocks revoked users and prevents re-enrollment', async () => {
        putGroup(WORKSHOP);
        putUser({ email: 'alice@test.dev', group_id: WORKSHOP.id, enrolled_at: past(2), revoked: true });
        const res = await getConversations(await reqAs('alice@test.dev'));
        expect(res.status).toBe(403);
        expect((await res.json()).error).toBe('revoked');
        const re = await enroll(await reqAs('alice@test.dev', { body: { code: 'TEST-CODE' } }));
        expect(re.status).toBe(403);
    });

    it('enforces the group model set on conversation create', async () => {
        putGroup(WORKSHOP);
        putUser({ email: 'alice@test.dev', group_id: WORKSHOP.id, enrolled_at: past(1) });

        const denied = await createConversation(await reqAs('alice@test.dev', { body: { models: ['model-zzz'] } }));
        expect(denied.status).toBe(403);
        expect((await denied.json()).error).toBe('models_not_allowed');

        const ok = await createConversation(await reqAs('alice@test.dev', { body: { models: ['model-a'] } }));
        expect(ok.status).toBe(200);

        // No models requested → app defaults aren't in the group set → falls back to group's list
        const fallback = await createConversation(await reqAs('alice@test.dev', { body: {} }));
        const data = await fallback.json();
        expect(fallback.status).toBe(200);
        expect(data.conversation.models).toEqual(['model-a', 'model-b']);
    });

    it('isolates conversations between users; admin sees all', async () => {
        putGroup(WORKSHOP);
        putUser({ email: 'alice@test.dev', group_id: WORKSHOP.id, enrolled_at: past(1) });
        putUser({ email: 'bob@test.dev', group_id: WORKSHOP.id, enrolled_at: past(1) });

        const created = await (await createConversation(await reqAs('alice@test.dev', { body: { models: ['model-a'] } }))).json();
        const id = created.conversation.id;

        expect((await getConversation(await reqAs('alice@test.dev'), routeProps({ id }))).status).toBe(200);
        expect((await getConversation(await reqAs('bob@test.dev'), routeProps({ id }))).status).toBe(404);
        expect((await getConversation(await reqAs('admin@test.dev'), routeProps({ id }))).status).toBe(200);

        const bobList = await (await getConversations(await reqAs('bob@test.dev'))).json();
        expect(bobList.conversations).toEqual([]);
    });

    it('enforces the daily run cap with 429', async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error('network disabled in tests'));
        putGroup(WORKSHOP); // runs_per_day: 2
        putUser({ email: 'alice@test.dev', group_id: WORKSHOP.id, enrolled_at: past(1) });
        const created = await (await createConversation(await reqAs('alice@test.dev', { body: { models: ['model-a'] } }))).json();
        const id = created.conversation.id;

        const msg = () => reqAs('alice@test.dev', { body: { content: 'hi' } }).then(r => postMessage(r, routeProps({ id })));
        expect((await msg()).status).not.toBe(429);
        expect((await msg()).status).not.toBe(429);
        const third = await msg();
        expect(third.status).toBe(429);
        expect((await third.json()).error).toBe('run_limit_reached');
    });

    it('restricts admin APIs to admins and creates groups with join codes', async () => {
        putGroup(WORKSHOP);
        putUser({ email: 'alice@test.dev', group_id: WORKSHOP.id, enrolled_at: past(1) });
        expect((await adminGroups(await reqAs('alice@test.dev', { body: { name: 'X' } }))).status).toBe(403);
        expect((await adminOverview(await reqAs('alice@test.dev'))).status).toBe(403);

        const res = await adminGroups(await reqAs('admin@test.dev', { body: { name: 'New Cohort', models: ['model-a'], runs_per_day: 5, valid_until: future(48) } }));
        expect(res.status).toBe(200);
        const { group } = await res.json();
        expect(group.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
        expect(group.runs_per_day).toBe(5);

        const overview = await (await adminOverview(await reqAs('admin@test.dev'))).json();
        expect(overview.groups.map(g => g.name)).toContain('New Cohort');
    });

    it('ignores forged admin claims in the JWT (env allowlist is authoritative)', async () => {
        putGroup(WORKSHOP);
        const forged = await reqAs('mallory@test.dev', { body: { name: 'X' }, admin: true });
        expect((await adminGroups(forged)).status).toBe(403);
    });
});
