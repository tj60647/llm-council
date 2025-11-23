import * as memory from './memory.js';

const ADAPTER = process.env.STORAGE_ADAPTER || 'memory';
let impl = memory; // future: dynamic import based on ADAPTER

export const createConversation = impl.createConversation;
export const listConversations = impl.listConversations;
export const getConversation = impl.getConversation;
export const updateTitle = impl.updateTitle;
export const addUserMessage = impl.addUserMessage;
export const addAssistantMessage = impl.addAssistantMessage;
export const conversationCount = impl.conversationCount;
export const updateConversationModels = impl.updateConversationModels;
export function adapterName() { return ADAPTER; }
