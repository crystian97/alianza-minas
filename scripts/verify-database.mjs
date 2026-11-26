import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';

// PostgreSQL local em WASM. Auth/Storage são contratos mínimos simulados;
// o script SQL deve também passar no Supabase antes de conectar a aplicação.
const db = new PGlite();
try {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
    $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    create schema storage;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text);
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon, authenticated;
    grant select, insert, update, delete on storage.objects to anon, authenticated;
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/202611250001_initial.sql', import.meta.url), 'utf8'));
  const results = await db.exec(await readFile(new URL('../supabase/tests/validate_cruds.sql', import.meta.url), 'utf8'));
  console.log(results.at(-1).rows);
  await db.exec(await readFile(new URL('../supabase/migrations/202611250002_player_transactions.sql', import.meta.url), 'utf8'));
  console.log((await db.exec(await readFile(new URL('../supabase/tests/player_transactions.sql', import.meta.url), 'utf8'))).at(-1).rows);
  await db.exec(await readFile(new URL('../supabase/migrations/202611250003_admin_modules.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/202611260002_match_visibility.sql', import.meta.url), 'utf8'));
  console.log((await db.exec(await readFile(new URL('../supabase/tests/admin_modules.sql', import.meta.url), 'utf8'))).at(-1).rows);
  await db.exec(await readFile(new URL('../supabase/migrations/202611260001_player_access.sql', import.meta.url), 'utf8'));
  console.log((await db.exec(await readFile(new URL('../supabase/tests/player_access.sql', import.meta.url), 'utf8'))).at(-1).rows);
  const { rows } = await db.query('select count(*)::int as count from auth.users');
  if (rows[0].count !== 0) throw new Error('Fixtures de teste não foram revertidas.');
  console.log('OK: rollback preservou o banco sem usuários de teste.');
} catch (error) {
  console.error({ message: error.message, code: error.code, detail: error.detail, where: error.where });
  process.exitCode = 1;
} finally {
  await db.close();
}
