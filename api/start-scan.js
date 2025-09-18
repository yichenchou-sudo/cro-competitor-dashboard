export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const { urls } = await request.json();
  if (!urls || !Array.isArray(urls)) {
    return new Response(JSON.stringify({ error: 'Invalid `urls` array' }), { status: 400 });
  }

  // Get the URL of our own Vercel deployment
  const vercelUrl = process.env.VERCEL_URL;
  if (!vercelUrl) {
    return new Response(JSON.stringify({ error: 'VERCEL_URL is not set' }), { status: 500 });
  }
  const destinationUrl = `https://${vercelUrl}/api/process-scan`;

  // This sends the slow job to the QStash queue to be processed in the background
  const response = await fetch(process.env.QSTASH_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.QSTASH_TOKEN}`,
      'Upstash-Forward-Content-Type': 'application/json',
      'Upstash-Url': destinationUrl,
    },
    body: JSON.stringify({ urls: urls }),
  });

  if (!response.ok) {
    console.error('QStash Error:', await response.text());
    return new Response(JSON.stringify({ error: 'Failed to schedule scan.' }), { status: 500 });
  }

  // Instantly respond to the user that the scan has begun
  return new Response(JSON.stringify({ message: 'Scan successfully queued.' }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
