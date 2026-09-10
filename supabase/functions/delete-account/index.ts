import { createClient } from 'npm:@supabase/supabase-js@2';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};
const reply = (status: number, error?: string) => new Response(JSON.stringify(error ? { error } : { deleted: true }), { status, headers });

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return reply(405, 'method_not_allowed');
  try {
    const token = request.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return reply(401, 'unauthorized');
    const url = Deno.env.get('SUPABASE_URL')!;
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user?.email) return reply(401, 'unauthorized');
    const body = await request.json();
    if (typeof body.password !== 'string' || !body.password || body.password.length > 4096) return reply(400, 'password_required');
    // Authenticate the password against the verified token owner's email.
    // Never accept a target user ID/email from the request body.
    const verifier = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
    const verified = await verifier.auth.signInWithPassword({ email: data.user.email, password: body.password });
    if (verified.error || verified.data.user?.id !== data.user.id) return reply(403, 'password_invalid');
    await verifier.auth.signOut({ scope: 'local' });
    const result = await admin.auth.admin.deleteUser(data.user.id);
    if (result.error) return reply(500, 'delete_failed');
    return reply(200);
  } catch { return reply(500, 'delete_failed'); }
});
