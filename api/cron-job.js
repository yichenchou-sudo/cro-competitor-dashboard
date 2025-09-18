import { kv } from '@vercel/kv';

export const config = {
  runtime: 'edge',
};

// This function is triggered by the cron schedule in vercel.json
export default async function handler(request) {
  const urls = await kv.get('monitoring-urls');
  if (!urls || urls.length === 0) {
    return new Response("Cron: No URLs to scan.", { status: 200 });
  }

  const vercelUrl = process.env.VERCEL_URL;
  if (!vercelUrl) {
    return new Response("Cron: VERCEL_URL is not set", { status: 500 });
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
    console.error('Cron: QStash Error:', await response.text());
    return new Response("Cron: Failed to queue scan.", { status: 500 });
  }

  return new Response("Cron: Scan successfully queued.", { status: 200 });
}

