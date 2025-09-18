import { kv } from '@vercel/kv';

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
    try {
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
        return new Response(JSON.stringify({ error: 'Failed to fetch URL list from database.' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
    }
}

