import { kv } from '@vercel/kv';

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const { urls } = await request.json();
  if (!Array.isArray(urls)) {
    return new Response(JSON.stringify({ error: 'Invalid `urls` array' }), { status: 400 });
  }

  await kv.set('monitoring-urls', urls);

  return new Response(JSON.stringify({ success: true, message: 'URL list updated.' }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

