import { kv } from '@vercel/kv';

export const config = { runtime: 'edge' };

export default async function handler(request) {
  try {
    // Before calling KV, check if required env vars are present
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      console.error('Missing KV environment variables:', {
        KV_REST_API_URL: !!process.env.KV_REST_API_URL,
        KV_REST_API_TOKEN: !!process.env.KV_REST_API_TOKEN,
      });
      return new Response(JSON.stringify({
        error: 'Missing KV_REST_API_URL or KV_REST_API_TOKEN. Check Vercel → Settings → Environment Variables.'
      }), { status: 500 });
    }

    const urls = await kv.get('monitoring-urls');
    return new Response(JSON.stringify({ urls: urls || [] }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Error fetching URL list from KV:', error);
    return new Response(JSON.stringify({
      error: `KV fetch failed: ${error.message}. Likely invalid token or DB misconfigured.`
    }), { status: 500 });
  }
}
