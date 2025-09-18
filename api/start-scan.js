import { kv } from '@vercel/kv';

export const config = {
  runtime: 'edge',
};

// This function is triggered by the 'Force Scan' button
export default async function handler(request) {
  try {
    const urls = await kv.get('monitoring-urls');
    if (!urls || urls.length === 0) {
      return new Response(JSON.stringify({ message: "No URLs to scan." }), { status: 200 });
    }
    
    const vercelUrl = process.env.VERCEL_URL;
    if (!vercelUrl) {
      return new Response(JSON.stringify({ error: 'VERCEL_URL is not set' }), { status: 500 });
    }
    const destinationUrl = `https://${vercelUrl}/api/process-scan`;

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
      console.error('Manual Scan: QStash Error:', await response.text());
      throw new Error('Failed to queue scan via QStash.');
    }

    return new Response(JSON.stringify({ message: 'Scan successfully queued.' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in start-scan:', error);
    return new Response(JSON.stringify({ error: `A server error occurred in start-scan: ${error.message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

