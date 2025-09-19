import { kv } from '@vercel/kv';

export const config = {
  runtime: 'edge',
};

export default async function handler() {
  const envCheck = {
    KV_REST_API_URL: Boolean(process.env.KV_REST_API_URL),
    KV_REST_API_TOKEN: Boolean(process.env.KV_REST_API_TOKEN),
  };

  try {
    if (!envCheck.KV_REST_API_URL || !envCheck.KV_REST_API_TOKEN) {
      return new Response(
        JSON.stringify({
          status: 'error',
          message: 'Missing KV_REST_API_URL or KV_REST_API_TOKEN',
          envCheck,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const testKey = `kv-diagnostics-test:${Date.now()}`;
    const writeResult = await kv.set(testKey, 'diagnostics-ok', { ex: 60 });
    const readResult = await kv.get(testKey);

    return new Response(
      JSON.stringify({
        status: 'ok',
        message: 'KV connected successfully',
        envCheck,
        writeResult,
        readResult,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('KV Diagnostics Error:', err);
    return new Response(
      JSON.stringify({
        status: 'error',
        message: 'KV write/get failed',
        error: err.message,
        envCheck,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
