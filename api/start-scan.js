import { kv } from '@vercel/kv';

export const config = { runtime: 'edge' };

export default async function handler(request) {
  try {
    const urls = await kv.get('monitoring-urls').catch(err => {
      console.error('KV Error:', err);
      throw new Error(`Failed to connect to Vercel KV: ${err.message}`);
    });

    if (!urls || urls.length === 0) {
      return new Response(JSON.stringify({ message: "No URLs to scan." }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!process.env.VERCEL_URL) {
      return new Response(JSON.stringify({ error: 'VERCEL_URL is not set' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const destinationUrl = `https://${process.env.VERCEL_URL}/api/process-scan`;

    const response = await fetch(process.env.QSTASH_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.QSTASH_TOKEN}`,
        'Upstash-Forward-Content-Type': 'application/json',
        'Upstash-Url': destinationUrl,
      },
      body: JSON.stringify({ urls }),
    });

    if (!response.ok) {
      const txt = await response.text();
      console.error('Manual Scan: QStash Error:', txt);
      throw new Error(`QStash responded with ${response.status}: ${txt}`);
    }

    return new Response(JSON.stringify({ message: 'Scan successfully queued.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in start-scan:', error);
    return new Response(JSON.stringify({
      error: `A server error occurred in start-scan: ${error.message}`
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
