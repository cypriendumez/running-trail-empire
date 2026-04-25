/**
 * POST /api/admin/migrate-full
 * Complete Supabase schema for long-term athlete data (>2 years).
 * Call once from the admin panel.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ADMIN_SECRET = process.env.ADMIN_SECRET;

const MIGRATIONS: { name: string; sql: string }[] = [
  // ── workouts ─────────────────────────────────────────────────────────────────
  {
    name: "workouts_table",
    sql: `
      CREATE TABLE IF NOT EXISTS workouts (
        id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id                  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        title                    text NOT NULL,
        type                     text NOT NULL DEFAULT 'easy',
        date                     date NOT NULL,
        duration_seconds         integer,
        distance_km              numeric(8,3),
        elevation_gain_m         numeric(8,1),
        elevation_loss_m         numeric(8,1),
        avg_hr                   integer,
        max_hr                   integer,
        avg_pace_min_km          numeric(6,3),
        avg_power_watts          integer,
        max_power_watts          integer,
        avg_cadence_spm          integer,
        tss                      numeric(8,2),
        training_effect          numeric(4,2),
        anaerobic_te             numeric(4,2),
        cardiac_decoupling       numeric(6,2),
        vertical_oscillation_cm  numeric(6,2),
        ground_contact_time_ms   integer,
        stride_length_m          numeric(5,3),
        vertical_ratio           numeric(5,2),
        gpx_url                  text,
        notes                    text,
        source                   text DEFAULT 'manual',
        external_id              text,
        created_at               timestamptz DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS workouts_user_date_title_idx
        ON workouts(user_id, date, title);
      CREATE INDEX IF NOT EXISTS workouts_user_date_idx ON workouts(user_id, date DESC);
    `,
  },

  // ── power_zone_distribution ───────────────────────────────────────────────────
  {
    name: "power_zone_distribution",
    sql: `
      CREATE TABLE IF NOT EXISTS power_zone_distribution (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workout_id    uuid REFERENCES workouts(id) ON DELETE CASCADE,
        user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        z1_seconds    integer DEFAULT 0,
        z2_seconds    integer DEFAULT 0,
        z3_seconds    integer DEFAULT 0,
        z4_seconds    integer DEFAULT 0,
        z5_seconds    integer DEFAULT 0,
        aerobic_te    numeric(4,2),
        anaerobic_te  numeric(4,2),
        created_at    timestamptz DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS pzd_workout_idx ON power_zone_distribution(workout_id);
    `,
  },

  // ── hrv_data ──────────────────────────────────────────────────────────────────
  {
    name: "hrv_data",
    sql: `
      CREATE TABLE IF NOT EXISTS hrv_data (
        id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        date                 date NOT NULL,
        hrv_ms               numeric(7,2),
        rmssd                numeric(7,2),
        sdnn                 numeric(7,2),
        physiological_state  text CHECK (physiological_state IN ('recovery','optimal','competition')),
        source               text DEFAULT 'manual',
        notes                text,
        created_at           timestamptz DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS hrv_user_date_idx ON hrv_data(user_id, date);
      CREATE INDEX IF NOT EXISTS hrv_user_date_desc ON hrv_data(user_id, date DESC);
    `,
  },

  // ── sleep_data ────────────────────────────────────────────────────────────────
  {
    name: "sleep_data",
    sql: `
      CREATE TABLE IF NOT EXISTS sleep_data (
        id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        date                date NOT NULL,
        total_sleep_min     integer,
        deep_sleep_min      integer,
        light_sleep_min     integer,
        rem_sleep_min       integer,
        awake_min           integer,
        sleep_score         integer CHECK (sleep_score BETWEEN 0 AND 100),
        body_battery_start  integer,
        body_battery_end    integer,
        respiration_rate    numeric(5,2),
        spo2_avg            numeric(5,2),
        spo2_min            numeric(5,2),
        stress_avg          integer,
        source              text DEFAULT 'manual',
        created_at          timestamptz DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS sleep_user_date_idx ON sleep_data(user_id, date);
    `,
  },

  // ── performance_baselines ─────────────────────────────────────────────────────
  {
    name: "performance_baselines",
    sql: `
      CREATE TABLE IF NOT EXISTS performance_baselines (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        tested_at    date NOT NULL,
        vma_kmh      numeric(5,2),
        ftp_watts    integer,
        lthr_bpm     integer,
        max_hr       integer,
        resting_hr   integer,
        vo2max       numeric(5,2),
        weight_kg    numeric(5,2),
        notes        text,
        created_at   timestamptz DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS perf_user_date ON performance_baselines(user_id, tested_at DESC);
    `,
  },

  // ── weather_history ───────────────────────────────────────────────────────────
  {
    name: "weather_history",
    sql: `
      CREATE TABLE IF NOT EXISTS weather_history (
        id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        workout_id     uuid REFERENCES workouts(id) ON DELETE SET NULL,
        date           date NOT NULL,
        temp_c         numeric(5,2),
        feels_like_c   numeric(5,2),
        humidity_pct   integer,
        wind_kmh       numeric(6,2),
        wind_gust_kmh  numeric(6,2),
        pressure_hpa   numeric(7,2),
        condition      text,
        aqi            integer,
        dew_point_c    numeric(5,2),
        precip_mm      numeric(6,2),
        created_at     timestamptz DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS weather_user_date ON weather_history(user_id, date DESC);
    `,
  },

  // ── weekly_summaries ──────────────────────────────────────────────────────────
  {
    name: "weekly_summaries",
    sql: `
      CREATE TABLE IF NOT EXISTS weekly_summaries (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        week_start      date NOT NULL,
        total_km        numeric(8,2),
        total_elevation numeric(8,1),
        total_tss       numeric(8,2),
        total_duration_h numeric(6,2),
        avg_hrv         numeric(7,2),
        avg_sleep_score integer,
        avg_body_battery integer,
        atl             numeric(8,2),   -- Acute Training Load
        ctl             numeric(8,2),   -- Chronic Training Load
        tsb             numeric(8,2),   -- Training Stress Balance
        created_at      timestamptz DEFAULT now(),
        updated_at      timestamptz DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS weekly_user_week ON weekly_summaries(user_id, week_start);
    `,
  },

  // ── ai_advice ─────────────────────────────────────────────────────────────────
  {
    name: "ai_advice",
    sql: `
      CREATE TABLE IF NOT EXISTS ai_advice (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        week_start      date NOT NULL,
        gemini_report   text,
        gemini_json     jsonb,
        coach_advice    text,
        advice_author   text DEFAULT 'gemini',
        published       boolean DEFAULT false,
        published_at    timestamptz,
        created_at      timestamptz DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS ai_advice_user_week ON ai_advice(user_id, week_start);
      CREATE INDEX IF NOT EXISTS ai_advice_published ON ai_advice(user_id, published, week_start DESC);
    `,
  },

  // ── user_routes (Trail Builder) ───────────────────────────────────────────────
  {
    name: "user_routes",
    sql: `
      CREATE TABLE IF NOT EXISTS user_routes (
        id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        name              text NOT NULL,
        coordinates       jsonb NOT NULL,
        distance_km       numeric(8,3),
        elevation_gain_m  numeric(8,1),
        duration_min      numeric(8,1),
        difficulty        text DEFAULT 'green',
        created_at        timestamptz DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS user_routes_user ON user_routes(user_id, created_at DESC);
    `,
  },

  // ── RLS policies ──────────────────────────────────────────────────────────────
  {
    name: "rls_workouts",
    sql: `
      ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "workouts_self" ON workouts;
      CREATE POLICY "workouts_self" ON workouts USING (auth.uid() = user_id);
    `,
  },
  {
    name: "rls_hrv",
    sql: `
      ALTER TABLE hrv_data ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "hrv_self" ON hrv_data;
      CREATE POLICY "hrv_self" ON hrv_data USING (auth.uid() = user_id);
    `,
  },
  {
    name: "rls_sleep",
    sql: `
      ALTER TABLE sleep_data ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "sleep_self" ON sleep_data;
      CREATE POLICY "sleep_self" ON sleep_data USING (auth.uid() = user_id);
    `,
  },
  {
    name: "rls_weather",
    sql: `
      ALTER TABLE weather_history ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "weather_self" ON weather_history;
      CREATE POLICY "weather_self" ON weather_history USING (auth.uid() = user_id);
    `,
  },
  {
    name: "rls_user_routes",
    sql: `
      ALTER TABLE user_routes ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "routes_self" ON user_routes;
      CREATE POLICY "routes_self" ON user_routes USING (auth.uid() = user_id);
    `,
  },

  // ── Extra columns (idempotent adds) ──────────────────────────────────────────
  {
    name: "workouts_add_columns",
    sql: `
      ALTER TABLE workouts ADD COLUMN IF NOT EXISTS anaerobic_te          numeric(4,2);
      ALTER TABLE workouts ADD COLUMN IF NOT EXISTS vertical_oscillation_cm numeric(6,2);
      ALTER TABLE workouts ADD COLUMN IF NOT EXISTS ground_contact_time_ms  integer;
      ALTER TABLE workouts ADD COLUMN IF NOT EXISTS stride_length_m         numeric(5,3);
      ALTER TABLE workouts ADD COLUMN IF NOT EXISTS vertical_ratio           numeric(5,2);
      ALTER TABLE workouts ADD COLUMN IF NOT EXISTS max_power_watts          integer;
      ALTER TABLE workouts ADD COLUMN IF NOT EXISTS external_id              text;
    `,
  },
  {
    name: "sleep_add_columns",
    sql: `
      ALTER TABLE sleep_data ADD COLUMN IF NOT EXISTS awake_min    integer;
      ALTER TABLE sleep_data ADD COLUMN IF NOT EXISTS stress_avg   integer;
      ALTER TABLE sleep_data ADD COLUMN IF NOT EXISTS spo2_min     numeric(5,2);
    `,
  },
];

export async function POST(req: Request) {
  const authHeader = req.headers.get("x-admin-secret");
  if (authHeader !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const results: { name: string; status: "ok" | "error"; message?: string }[] = [];

  for (const { name, sql } of MIGRATIONS) {
    try {
      // Supabase doesn't expose raw SQL via the JS client directly —
      // we use the REST API with service role to execute SQL
      const resp = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
          },
          body: JSON.stringify({ sql }),
        }
      );

      if (resp.ok) {
        results.push({ name, status: "ok" });
      } else {
        const errText = await resp.text();
        // If it's "already exists" type errors, still count as ok
        if (errText.includes("already exists") || errText.includes("duplicate")) {
          results.push({ name, status: "ok", message: "already exists" });
        } else {
          results.push({ name, status: "error", message: errText.slice(0, 200) });
        }
      }
    } catch (e) {
      results.push({ name, status: "error", message: String(e) });
    }
  }

  const ok = results.filter(r => r.status === "ok").length;
  const failed = results.filter(r => r.status === "error");

  return NextResponse.json({
    total: results.length,
    ok,
    failed: failed.length,
    results,
    note: "If exec_sql RPC is not available, copy the SQL from the source and run it in your Supabase SQL editor.",
  });
}
