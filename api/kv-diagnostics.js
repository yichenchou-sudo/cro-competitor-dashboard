import { kv } from '@vercel/kv';

export const config = {
  runtime: 'edge',
};

export default async function handler() {
  try {
    // Check if env vars are present
    const envCheck = {
      KV_REST_API_URL: !!process.env.KV_REST_API_URL,
      KV_REST_API_TOKEN: !!process.env.KV_REST_API_TOKEN,
    };

    // Try a test set/get
    const testKey = `kv-diagnostics-test:${Date.now()}`;
    let writeResult = null;
    let readResult = null;

    try {
      writeResult = await kv.set(testKey, 'diagnostics-ok', { ex: 60 }); // expires in 60s
      readResult = await kv.get(testKey);
    } catch (err) {
      console.error('KV Test Error:', err);
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
    return new Response(
      JSON.stringify({
        status: 'error',
        message: 'Unexpected error running diagnostics',
        error: err.message,
