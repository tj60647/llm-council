import { NextResponse } from 'next/server';
import { conversationCount } from '../../../lib/storage/memory.js';

export async function GET() {
    return NextResponse.json({ status: 'ok', conversations: conversationCount(), ts: Date.now() });
}
