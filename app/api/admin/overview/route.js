import { NextResponse } from 'next/server';
import { requireAdmin, todayUTC } from '../../../../lib/auth/guard.js';
import { listGroups, listUsers, getRunCount, adapterName } from '../../../../lib/storage/index.js';
import { authEnabled } from '../../../../lib/auth/config.js';

export async function GET(req) {
    const gate = await requireAdmin(req);
    if (!gate.ok) return gate.response;
    const [groups, users] = await Promise.all([listGroups(), listUsers()]);
    const groupNames = Object.fromEntries(groups.map(g => [g.id, g.name]));
    const date = todayUTC();
    const usersOut = await Promise.all(users.map(async u => ({
        ...u,
        group_name: groupNames[u.group_id] || null,
        runs_today: await getRunCount(u.email, date)
    })));
    const groupsOut = groups.map(g => ({
        ...g,
        member_count: users.filter(u => u.group_id === g.id).length
    }));
    return NextResponse.json({ adapter: adapterName(), auth_enabled: authEnabled(), groups: groupsOut, users: usersOut });
}
