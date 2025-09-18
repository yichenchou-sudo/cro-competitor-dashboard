import { kv } from '@vercel/kv';

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  try {
    const report = await kv.get('latestReport');
    
    if (!report) {
      return new Response(JSON.stringify({ error: 'No report found.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(report), {
      status: 200,
      headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
       },
    });
  } catch (error) {
    console.error('Error fetching report from KV:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch report.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
