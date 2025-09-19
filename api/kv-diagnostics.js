import { kv } from '@vercel/kv';

export const config = {
  runtime: 'edge',
};

export default async function handler() {
  // Minimal: just return something to prove the build works
  return new Response(
    JSON.stringify({ status: 'ok', message: 'Diagnostics endpoint deployed successfully' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

