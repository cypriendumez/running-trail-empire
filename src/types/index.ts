// ─── User & Profile ──────────────────────────────────────────────────────────

export type UserMode = "ludique" | "elite";
export type PhysiologicalState = "recovery" | "optimal" | "competition";
export type Chronotype = "morning" | "evening" | "neutral";
export type HormonalPhase = "follicular" | "ovulatory" | "luteal" | "menstrual";
export type SubscriptionTier = "free" | "pro" | "elite";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  age: number;
  height_cm: number;
  weight_kg: number;
  gender: "male" | "female" | "other";
  chronotype: Chronotype;
  mode: UserMode;
  subscription_tier: SubscriptionTier;
  discipline_score: number;
  league: LeagueTier;
  is_female_cycle_sync: boolean;
  current_phase?: HormonalPhase;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  created_at: string;
}

// ─── Performance Metrics ─────────────────────────────────────────────────────

export interface PerformanceBaseline {
  user_id: string;
  vma_kmh: number;           // Vitesse Maximale Aérobie
  ftp_watts?: number;        // Functional Threshold Power
  max_hr: number;
  resting_hr: number;
  lactate_threshold_hr: number;
  tested_at: string;
}

export interface TrainingZones {
  z1: [number, number]; // Active Recovery
  z2: [number, number]; // Aerobic Base
  z3: [number, number]; // Tempo
  z4: [number, number]; // Threshold
  z5: [number, number]; // VO2 Max
  z6: [number, number]; // Anaerobic
}

export interface BiomechanicsData {
  cadence_spm: number;
  vertical_oscillation_cm: number;
  ground_contact_time_ms: number;
  stride_length_m: number;
  vertical_ratio: number;
  power_watts?: number;
  running_effectiveness?: number;
}

export interface HRVData {
  user_id: string;
  date: string;
  hrv_ms: number;
  rmssd: number;
  sdnn: number;
  physiological_state: PhysiologicalState;
}

// ─── Workout & Activity ──────────────────────────────────────────────────────

export type WorkoutType = "easy" | "tempo" | "interval" | "long_run" | "race" | "recovery" | "strength" | "trail" | "vma" | "hill_repeat";
export type TrailDifficulty = "green" | "blue" | "red" | "black";

export interface Workout {
  id: string;
  user_id: string;
  title: string;
  type: WorkoutType;
  date: string;
  duration_seconds: number;
  distance_km: number;
  elevation_gain_m: number;
  elevation_loss_m?: number;
  avg_hr?: number;
  max_hr?: number;
  avg_pace_min_km?: number;
  avg_power_watts?: number;
  max_power_watts?: number;
  avg_cadence_spm?: number;
  tss?: number;                         // Training Stress Score
  training_effect?: number;             // 1-5 (aerobic)
  anaerobic_te?: number;                // 0-5 (anaerobic training effect)
  cardiac_decoupling?: number;          // %
  avg_ascent_speed_mh?: number;
  // Biomechanics (Garmin / Running Dynamics)
  vertical_oscillation_cm?: number;     // cm
  ground_contact_time_ms?: number;      // ms — canonical name (was ground_contact_ms)
  ground_contact_ms?: number;           // alias kept for backward compat
  stride_length_m?: number;             // m
  vertical_ratio?: number;              // % (oscillation / stride length)
  // Power zones (seconds spent per zone)
  power_z1_s?: number;
  power_z2_s?: number;
  power_z3_s?: number;
  power_z4_s?: number;
  power_z5_s?: number;
  gpx_url?: string;
  weather?: WeatherConditions;
  biomechanics?: BiomechanicsData;
  notes?: string;
  source: "manual" | "garmin" | "coros" | "strava" | "apple_health" | "polar" | "intervals_icu";
  created_at: string;
}

// ─── Training Plan ───────────────────────────────────────────────────────────

export interface TrainingPlan {
  id: string;
  user_id: string;
  race_id?: string;
  name: string;
  start_date: string;
  race_date: string;
  weekly_volume_km: number;
  weeks: TrainingWeek[];
  target_time_seconds?: number;
  created_by: "user" | "ai";
  created_at: string;
}

export interface TrainingWeek {
  week_number: number;
  start_date: string;
  total_km: number;
  total_elevation_m: number;
  ctl: number;  // Chronic Training Load
  atl: number;  // Acute Training Load
  tsb: number;  // Training Stress Balance
  sessions: TrainingSession[];
}

export interface TrainingSession {
  day_of_week: number;
  type: WorkoutType;
  title: string;
  description: string;
  target_duration_min: number;
  target_distance_km?: number;
  target_elevation_m?: number;
  intensity_zone: 1 | 2 | 3 | 4 | 5;
  is_key_session: boolean;
}

// ─── Races ───────────────────────────────────────────────────────────────────

export type RaceType = "road_5k" | "road_10k" | "semi" | "marathon" | "trail_s" | "trail_m" | "trail_l" | "trail_xl" | "ultra";
export type RaceRegion =
  | "auvergne-rhone-alpes" | "bourgogne-franche-comte" | "bretagne"
  | "centre-val-de-loire" | "corse" | "grand-est" | "hauts-de-france"
  | "ile-de-france" | "normandie" | "nouvelle-aquitaine" | "occitanie"
  | "pays-de-la-loire" | "provence-alpes-cote-azur"
  | "guadeloupe" | "martinique" | "guyane" | "la-reunion" | "mayotte"
  | string; // allow scraped regions

export interface Race {
  id: string;
  name: string;
  type: RaceType;
  region: RaceRegion;
  department?: string;
  city?: string;
  date: string;
  distance_km: number;
  elevation_gain_m: number;
  max_participants?: number;
  difficulty: TrailDifficulty;
  terrain: string[];
  time_limits: TimeLimit[];
  registration_url?: string;
  gpx_url?: string;
  altitude_profile_url?: string;
  historical_weather?: WeatherConditions;
  organization?: string;
  description?: string;
  latitude?: number | null;
  longitude?: number | null;
  is_itra_certified?: boolean;
  itra_points?: number;
  created_at: string;
}

export interface TimeLimit {
  checkpoint: string;
  km: number;
  time_limit_seconds: number;
}

export interface RaceResult {
  id: string;
  user_id: string;
  race_id: string;
  finish_time_seconds?: number;
  position_overall?: number;
  position_category?: number;
  dnf: boolean;
  segment_times?: SegmentTime[];
  created_at: string;
}

export interface SegmentTime {
  checkpoint: string;
  time_seconds: number;
  pace_min_km: number;
  predicted_time?: number;
}

// ─── Shoes ───────────────────────────────────────────────────────────────────

export interface Shoe {
  id: string;
  user_id: string;
  brand: string;
  model: string;
  version?: string;
  purchase_date: string;
  km_at_purchase: number;
  current_km: number;
  max_km: number;      // Alert threshold (default 600)
  color?: string;
  image_url?: string;
  is_active: boolean;
  terrain: "road" | "trail" | "mixed";
  drop_mm: number;
  stack_mm: number;
  weight_g: number;
  notes?: string;
  best_race_time?: string;
}

// ─── Health & Physio ─────────────────────────────────────────────────────────

export type BodyPart =
  | "head" | "neck" | "left_shoulder" | "right_shoulder"
  | "left_elbow" | "right_elbow" | "left_wrist" | "right_wrist"
  | "chest" | "upper_back" | "lower_back" | "left_hip" | "right_hip"
  | "left_knee" | "right_knee" | "left_ankle" | "right_ankle"
  | "left_foot" | "right_foot" | "left_calf" | "right_calf"
  | "left_hamstring" | "right_hamstring" | "left_quad" | "right_quad"
  | "left_it_band" | "right_it_band";

export type PainLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type InjuryStage = "acute" | "subacute" | "chronic" | "healed";

export interface PhysioReport {
  id: string;
  user_id: string;
  body_part: BodyPart;
  pain_level: PainLevel;
  pain_type: "sharp" | "dull" | "burning" | "stiffness" | "weakness";
  when_occurs: "at_rest" | "during_run" | "after_run" | "always";
  stage: InjuryStage;
  diagnosis?: string;
  rehab_protocol?: RehabExercise[];
  reported_at: string;
}

export interface RehabExercise {
  name: string;
  sets: number;
  reps: number;
  duration_seconds?: number;
  video_url: string;
  description: string;
  frequency_per_week: number;
}

// ─── Nutrition ───────────────────────────────────────────────────────────────

export interface NutritionPlan {
  user_id: string;
  race_duration_h: number;
  carbs_g_per_hour: number;
  hydration_ml_per_hour: number;
  sodium_mg_per_hour: number;
  caffeine_mg_total?: number;
  checkpoints: NutritionCheckpoint[];
}

export interface NutritionCheckpoint {
  km: number;
  time_h: number;
  carbs_g: number;
  hydration_ml: number;
  sodium_mg: number;
  food_suggestions: string[];
}

// ─── Weather ─────────────────────────────────────────────────────────────────

export interface WeatherConditions {
  temperature_c: number;
  humidity_percent: number;
  wind_speed_kmh: number;
  wind_direction: string;
  precipitation_mm: number;
  altitude_m: number;
  feels_like_c: number;
  pace_adjustment_percent: number;
}

// ─── Gamification ────────────────────────────────────────────────────────────

export type LeagueTier = "bronze" | "silver" | "gold" | "platinum" | "diamond";

export interface DisciplineScore {
  total: number;
  precision_targets: number;    // 40%
  consistency: number;          // 40%
  recovery_quality: number;     // 20%
  trend: "up" | "down" | "stable";
  weekly_history: { week: string; score: number }[];
}

export interface League {
  id: string;
  tier: LeagueTier;
  name: string;
  members: LeagueMember[];
  week_start: string;
  week_end: string;
  rewards: string[];
}

export interface LeagueMember {
  user_id: string;
  full_name: string;
  avatar_url?: string;
  score: number;
  rank: number;
  trend: "up" | "down" | "stable";
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  unlocked_at?: string;
  progress?: number;
  max_progress?: number;
}

export interface TeamChallenge {
  id: string;
  name: string;
  description: string;
  route_name: string;
  total_km: number;
  team_members: string[];
  current_km: number;
  end_date: string;
  gpx_url: string;
}

// ─── Shopping ────────────────────────────────────────────────────────────────

export interface ShoeProduct {
  id: string;
  brand: string;
  model: string;
  version: string;
  price: number;
  image_url: string;
  url: string;
  retailer: "i-run" | "alltricks" | "lepape" | "ekosport" | "decathlon";
  in_stock: boolean;
  drop_mm: number;
  stack_mm: number;
  weight_g: number;
  terrain: "road" | "trail" | "mixed";
  cushioning: "minimal" | "moderate" | "maximal";
  compatibility_score?: number;
  bio_compatibility_reasons?: string[];
  last_checked: string;
}

// ─── Trail & Maps ─────────────────────────────────────────────────────────────

export interface TrailRoute {
  id: string;
  user_id?: string;
  name: string;
  description?: string;
  distance_km: number;
  elevation_gain_m: number;
  elevation_loss_m: number;
  max_altitude_m: number;
  min_altitude_m: number;
  difficulty: TrailDifficulty;
  terrain_types: string[];
  gpx_data?: string;
  geojson?: object;
  start_lat: number;
  start_lng: number;
  region: string;
  is_loop: boolean;
  estimated_time_min: number;
  surface_quality: "excellent" | "good" | "rough" | "technical";
  created_at: string;
  synced_to_garmin?: boolean;
  synced_to_coros?: boolean;
}

// ─── AI & Coaching ───────────────────────────────────────────────────────────

export interface AICoachMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  context?: {
    recent_workouts?: Workout[];
    hrv?: HRVData;
    upcoming_race?: Race;
  };
  created_at: string;
}

export interface GhostRunner {
  target_time_seconds: number;
  current_pace_min_km: number;
  predicted_finish_seconds: number;
  ahead_behind_seconds: number;
  remaining_km: number;
  vocal_cue?: string;
}

export interface TaperingPlan {
  start_date: string;
  race_date: string;
  target_tsb: number;  // +15 on race day
  weeks: TaperingWeek[];
}

export interface TaperingWeek {
  week: number;
  volume_reduction_percent: number;
  intensity_level: "low" | "medium" | "high";
  tsb_target: number;
  sessions: TrainingSession[];
}
