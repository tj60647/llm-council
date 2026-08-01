import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getHealth } from '../../app/api/health/route.js';
import { GET as getModels, resetCache } from '../../app/api/models/route.js';
import { GET as getConversations, POST as createConversation } from '../../app/api/conversations/route.js';
import { GET as getConversation } from '../../app/api/conversations/[id]/route.js';
import { resetMemory } from '../../lib/storage/memory.js';

// Mock dependencies
vi.mock('../../lib/storage/index.js', async () => {
    const memory = await vi.importActual('../../lib/storage/memory.js');
    return {
        ...memory,
        adapterName: () => 'memory-mock'
    };
});

// Mock environment
process.env.OPENROUTER_API_KEY = 'test-key';

describe('API Routes', () => {
    
    beforeEach(() => {
        resetMemory();
        vi.unstubAllGlobals();
    });

    describe('/api/health', () => {
        it('should return ok status', async () => {
            const response = await getHealth();
            const data = await response.json();
            
            expect(response.status).toBe(200);
            expect(data.status).toBe('ok');
            expect(data.ts).toBeDefined();
            expect(data.conversations).toBeDefined();
        });
    });

    describe('/api/models', () => {
        beforeEach(() => {
            resetCache();
        });

        it('should fetch and format models', async () => {
            // Mock fetch for OpenRouter API
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    data: [
                        { id: 'model1', name: 'Model 1', pricing: {}, context_length: 1000 },
                        { id: 'model2', name: 'Model 2', description: 'desc' }
                    ]
                })
            });

            const response = await getModels();
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.models).toHaveLength(2);
            expect(data.models[0]).toMatchObject({ id: 'model1', name: 'Model 1' });
            expect(fetch).toHaveBeenCalledWith('https://openrouter.ai/api/v1/models', expect.any(Object));
        });

        it('should handle fetch errors gracefully', async () => {
            global.fetch = vi.fn().mockRejectedValue(new Error('API Down'));
            
            const response = await getModels();
            const data = await response.json();
            
            expect(response.status).toBe(500);
            expect(data.error).toBe('API Down');
        });
    });

    describe('/api/conversations', () => {
        it('should list empty conversations initially', async () => {
            const response = await getConversations();
            const data = await response.json();
            
            expect(data.conversations).toEqual([]);
            expect(data.count).toBe(0);
        });

        it('should create a new conversation', async () => {
            const req = {
                json: async () => ({ models: ['model-a'] })
            };
            
            const response = await createConversation(req);
            const data = await response.json();
            
            expect(data.conversation).toBeDefined();
            expect(data.conversation.models).toEqual(['model-a']);
            expect(data.conversation.id).toBeDefined();
        });
    });

    describe('/api/conversations/[id]', () => {
        it('should return 404 for non-existent conversation', async () => {
            const context = { params: { id: 'missing' } };
            const response = await getConversation(null, context);
            
            expect(response.status).toBe(404);
        });

        it('should retrieve an existing conversation', async () => {
            // Create one first
            const createReq = { json: async () => ({ models: [] }) };
            const createRes = await createConversation(createReq);
            const { conversation } = await createRes.json();
            
            // Fetch it
            const context = { params: { id: conversation.id } };
            const response = await getConversation(null, context);
            const data = await response.json();
            
            expect(response.status).toBe(200);
            expect(data.conversation.id).toBe(conversation.id);
        });
    });
});
