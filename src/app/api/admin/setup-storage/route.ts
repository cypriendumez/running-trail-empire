export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseAdmin = createSupabaseAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const { secret } = await req.json().catch(() => ({}));
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: string[] = [];

  const policies = [
    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Avatar upload own folder'
      ) THEN
        CREATE POLICY "Avatar upload own folder"
          ON storage.objects FOR INSERT TO authenticated
          WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
        RAISE NOTICE 'Created upload policy';
      ELSE
        RAISE NOTICE 'Upload policy already exists';
      END IF;
    END $$;`,

    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Avatar update own folder'
      ) THEN
        CREATE POLICY "Avatar update own folder"
          ON storage.objects FOR UPDATE TO authenticated
          USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
        RAISE NOTICE 'Created update policy';
      ELSE
        RAISE NOTICE 'Update policy already exists';
      END IF;
    END $$;`,

    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Avatar public read'
      ) THEN
        CREATE POLICY "Avatar public read"
          ON storage.objects FOR SELECT TO public
          USING (bucket_id = 'avatars');
        RAISE NOTICE 'Created read policy';
      ELSE
        RAISE NOTICE 'Read policy already exists';
      END IF;
    END $$;`,
  ];

  for (const sql of policies) {
    try {
      const { error } = await supabaseAdmin.rpc("exec_sql", { sql });
      results.push(error ? `Note: ${error.message}` : "OK");
    } catch (e) {
      results.push(`Error: ${String(e)}`);
    }
  }

  return NextResponse.json({ results });
}
