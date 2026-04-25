import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseAdmin = createSupabaseAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  const migrations = [
    // Add unique constraint on races
    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'races_name_date_unique'
      ) THEN
        ALTER TABLE races ADD CONSTRAINT races_name_date_unique UNIQUE (name, date);
      END IF;
    END $$;`,

    // Add city column
    `ALTER TABLE races ADD COLUMN IF NOT EXISTS city text;`,

    // Ensure is_itra_certified exists
    `ALTER TABLE races ADD COLUMN IF NOT EXISTS is_itra_certified boolean DEFAULT false;`,

    // Ensure itra_points exists
    `ALTER TABLE races ADD COLUMN IF NOT EXISTS itra_points integer DEFAULT 0;`,
  ];

  const results: string[] = [];

  for (const sql of migrations) {
    try {
      const { error } = await supabaseAdmin.rpc("exec_sql", { sql }).single();
      if (error) {
        // Try direct query approach
        results.push(`Note: ${error.message}`);
      } else {
        results.push("OK");
      }
    } catch (e) {
      results.push(`Error: ${String(e)}`);
    }
  }

  return NextResponse.json({ results, message: "Migration attempted. Check Supabase SQL editor if needed." });
}
