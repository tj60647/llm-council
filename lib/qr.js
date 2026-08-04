// QR generation for group join links.
//
// Prefers QR Studio (an MCP service that renders styled QR codes with a logo
// overlay) when QRSTUDIO_API_KEY is set, and otherwise renders locally.
// The local path is the default on purpose: a join QR is projected during a
// live workshop, so it must not depend on a cold-starting external service.
import QRCode from 'qrcode';

const DEFAULT_QRSTUDIO = 'https://qrstudio.aroughidea.com/api/mcp';

export function qrStudioConfigured() {
    return Boolean(process.env.QRSTUDIO_API_KEY);
}

// Styled QR via QR Studio's generate_qr tool (JSON-RPC over Streamable HTTP).
async function fromQrStudio(url, size) {
    const endpoint = process.env.QRSTUDIO_URL || DEFAULT_QRSTUDIO;
    const key = process.env.QRSTUDIO_API_KEY;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 12000);
    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/event-stream',
                'X-API-Key': key
            },
            signal: controller.signal,
            body: JSON.stringify({
                jsonrpc: '2.0', id: 1, method: 'tools/call',
                params: {
                    name: 'generate_qr',
                    arguments: {
                        content: url, format: 'svg', size,
                        errorCorrectionLevel: 'H', // survives being photographed off a projector
                        dotsType: 'rounded'
                    }
                }
            })
        });
        if (!res.ok) throw new Error(`qrstudio ${res.status}`);
        const text = await res.text();
        // Streamable HTTP may answer as SSE frames or a plain JSON body
        const payload = text.startsWith('data:')
            ? JSON.parse(text.split('\n').find(l => l.startsWith('data:')).slice(5).trim())
            : JSON.parse(text);
        if (payload.error) throw new Error(payload.error.message || 'qrstudio error');
        const svg = payload.result?.content?.find(c => c.type === 'text')?.text;
        if (!svg || !svg.includes('<svg')) throw new Error('qrstudio returned no svg');
        return { svg, source: 'qrstudio' };
    } finally {
        clearTimeout(t);
    }
}

async function locally(url, size) {
    const svg = await QRCode.toString(url, {
        type: 'svg',
        errorCorrectionLevel: 'H',
        margin: 1,
        width: size,
        color: { dark: '#1e242cff', light: '#ffffffff' }
    });
    return { svg, source: 'local' };
}

export async function generateQrSvg(url, { size = 320 } = {}) {
    if (qrStudioConfigured()) {
        try {
            return await fromQrStudio(url, size);
        } catch (e) {
            console.warn('[qr] QR Studio unavailable, rendering locally:', e.message);
        }
    }
    return await locally(url, size);
}
