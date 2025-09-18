import { kv } from '@vercel/kv';

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const { urls } = await request.json();
    if (!Array.isArray(urls)) {
      throw new Error('Invalid `urls` array');
    }

    await kv.set('monitoring-urls', urls);

    return new Response(JSON.stringify({ success: true, message: 'URL list updated.' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in update-urls:', error);
    return new Response(JSON.stringify({ error: `A server error occurred in update-urls: ${error.message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

