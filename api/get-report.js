import { kv } from '@vercel/kv';

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  try {
    const reportJSON = await kv.get('latestReport');
    
    if (!reportJSON) {
      // If no report is found, this is normal. Return a successful response with empty data.
      return new Response(JSON.stringify({ reportData: [], lastUpdated: new Date().toISOString() }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // If a report is found, parse and return it.
    const report = JSON.parse(reportJSON);
    return new Response(JSON.stringify(report), {
      status: 200,
      headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
       },
    });
  } catch (error) {
    console.error('Error fetching/parsing report from KV:', error);
    return new Response(JSON.stringify({ error: `A server error occurred in get-report. This is likely due to a missing or incorrect Vercel KV (Upstash) environment variable. Error details: ${error.message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

