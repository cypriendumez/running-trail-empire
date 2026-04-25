export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("intervals_athlete_id, intervals_api_key")
      .eq("id", user.id)
      .single();

    const hasProfileCreds = !!(profile?.intervals_athlete_id && profile?.intervals_api_key);
    const hasEnvCreds = !!(
      process.env.INTERVALS_ICU_ATHLETE_ID &&
      process.env.INTERVALS_ICU_API_KEY &&
      process.env.INTERVALS_ICU_ATHLETE_ID.length > 2 &&
      process.env.INTERVALS_ICU_API_KEY.length > 4
    );

    return NextResponse.json({
      configured: hasProfileCreds || hasEnvCreds,
      source: hasProfileCreds ? "profile" : hasEnvCreds ? "env" : null,
    });
  }

  // Unauthenticated: only check env vars
  const configured = !!(
    process.env.INTERVALS_ICU_ATHLETE_ID &&
    process.env.INTERVALS_ICU_API_KEY &&
    process.env.INTERVALS_ICU_ATHLETE_ID.length > 2 &&
    process.env.INTERVALS_ICU_API_KEY.length > 4
  );
  return NextResponse.json({ configured, source: configured ? "env" : null });
}
