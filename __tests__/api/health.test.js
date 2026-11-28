import { describe, it, expect, vi } from 'vitest';
import { GET as getHealth } from '../../app/api/health/route.js';

// Storage that cannot be reached, with an error text that must not leave the server.
vi.mock('../../lib/storage/index.js', () => ({
    conversationCount: async () => { throw new Error('fetch failed: internal-host.example'); },
    adapterName: () => 'redis'
}));

describe('/api/health when storage is unreachable', () => {
    it('answers 503 not ok, logs the detail, and keeps it out of the body', async () => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => {});
        const res = await getHealth();
        expect(res.status).toBe(503);
        const text = await res.text();
        expect(JSON.parse(text).status).toBe('degraded');
        expect(text).not.toContain('fetch failed');
        expect(text).not.toContain('internal-host');
        expect(log).toHaveBeenCalled();
        log.mockRestore();
    });
});
