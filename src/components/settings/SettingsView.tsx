"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  User, Shield, Bell, Globe, Watch, CreditCard, Camera, Loader2, Check, LogOut,
  Mail, Lock, Volume2, VolumeX, Trash2, AlertTriangle, ChevronRight, BellRing, ExternalLink,
} from "lucide-react";
import { AVATAR_COLORS, colorOf } from "@/lib/avatarColors";
import { languageOptions } from "@/i18n/config";
import { useT } from "@/lib/i18n/LanguageProvider";
import type { Lang } from "@/lib/i18n/translations";

type Profile = Record<string, unknown>;
const s = (v: unknown) => (v == null ? "" : String(v));

const TABS = [
  { k: "profil", tk: "tab.profile", icon: User },
  { k: "securite", tk: "tab.security", icon: Shield },
  { k: "notifications", tk: "tab.notifications", icon: Bell },
  { k: "preferences", tk: "tab.preferences", icon: Globe },
  { k: "connexions", tk: "tab.connections", icon: Watch },
  { k: "compte", tk: "tab.account", icon: CreditCard },
] as const;
type TabKey = (typeof TABS)[number]["k"];

function Card({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
      <h2 className="text-base font-bold text-zinc-900">{title}</h2>
      {desc && <p className="mt-0.5 text-sm text-zinc-500">{desc}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[13px] font-semibold text-zinc-600">{label}</span>
      {children}
    </label>
  );
}
const inputCls = "w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100";

export function SettingsView({ profile, email, userId, settings }: { profile: Profile; email: string; userId: string; settings: Record<string, unknown> }) {
  const router = useRouter();
  const sb = createClient();
  const { t, lang, setLang } = useT();
  const [tab, setTab] = useState<TabKey>("profil");

  // ── Préférences serveur (couleur, unités, début de semaine) ──
  const [color, setColor] = useState(s(settings.avatarColor) || "emerald");
  const [units, setUnits] = useState<"metric" | "imperial">(s(settings.unitSystem) === "imperial" ? "imperial" : "metric");
  const [weekStart, setWeekStart] = useState<"mon" | "sun">(s(settings.weekStart) === "sun" ? "sun" : "mon");
  const saveSettings = async (patch: Record<string, unknown>, label: string) => {
    try {
      const r = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      const j = await r.json();
      if (j.ok) { toast.success(label); router.refresh(); } else toast.error(j.error || "Échec");
    } catch { toast.error("Erreur"); }
  };
  const ac = colorOf(color);

  // ── Profil ──
  const [avatar, setAvatar] = useState(s(profile.avatar_url));
  const [fullName, setFullName] = useState(s(profile.full_name));
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Sécurité ──
  const [pwd, setPwd] = useState(""); const [pwd2, setPwd2] = useState(""); const [savingPwd, setSavingPwd] = useState(false);
  const [newEmail, setNewEmail] = useState(""); const [savingEmail, setSavingEmail] = useState(false);

  // ── Notifications ──
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const [sound, setSound] = useState(true);
  useEffect(() => {
    try { setPerm("Notification" in window ? Notification.permission : "unsupported"); } catch { setPerm("unsupported"); }
    try { setSound(localStorage.getItem("rte:sound") !== "off"); } catch { /* ignore */ }
  }, []);

  // ── Suppression ──
  const [delText, setDelText] = useState(""); const [deleting, setDeleting] = useState(false);

  const intervalsOn = !!s(profile.intervals_athlete_id);
  const tier = s(profile.subscription_tier) || "free";
  const createdAt = s(profile.created_at);

  const uploadAvatar = async (file: File) => {
    setUploadingAvatar(true);
    try {
      const fd = new FormData(); fd.append("avatar", file);
      const r = await fetch("/api/profile/upload-avatar", { method: "POST", body: fd });
      const j = await r.json();
      if (j.url) { setAvatar(j.url); toast.success(t("toast.photoOk")); router.refresh(); }
      else toast.error(j.error || "Échec");
    } catch { toast.error("Erreur"); }
    finally { setUploadingAvatar(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    const { error } = await sb.from("profiles").update({ full_name: fullName.trim() }).eq("id", userId);
    setSavingProfile(false);
    if (error) toast.error(error.message); else { toast.success(t("toast.profileOk")); router.refresh(); }
  };

  const savePassword = async () => {
    if (pwd.length < 8) return toast.error(t("toast.pwdMin"));
    if (pwd !== pwd2) return toast.error(t("toast.pwdMismatch"));
    setSavingPwd(true);
    const { error } = await sb.auth.updateUser({ password: pwd });
    setSavingPwd(false);
    if (error) toast.error(error.message); else { toast.success(t("toast.pwdOk")); setPwd(""); setPwd2(""); }
  };

  const saveEmail = async () => {
    if (!/^\S+@\S+\.\S+$/.test(newEmail)) return toast.error(t("toast.emailInvalid"));
    setSavingEmail(true);
    const { error } = await sb.auth.updateUser({ email: newEmail.trim() });
    setSavingEmail(false);
    if (error) toast.error(error.message);
    else { toast.success(`${t("toast.emailSent")} ${newEmail}`); setNewEmail(""); }
  };

  const changeLang = (l: Lang) => { setLang(l); toast.success(t("toast.lang")); };

  const askPermission = async () => {
    try { const p = await Notification.requestPermission(); setPerm(p); if (p === "granted") toast.success(t("set.notif.on")); else toast(t("set.notif.hintBlocked")); }
    catch { toast.error("—"); }
  };
  const toggleSound = () => { const v = !sound; setSound(v); try { localStorage.setItem("rte:sound", v ? "on" : "off"); } catch { /* ignore */ } toast(v ? "🔊" : "🔇"); };

  const signOut = async () => { await sb.auth.signOut(); router.push("/login"); };

  const deleteAccount = async () => {
    if (delText !== "SUPPRIMER") return;
    setDeleting(true);
    try {
      const r = await fetch("/api/account/delete", { method: "POST" });
      const j = await r.json();
      if (j.ok) { await sb.auth.signOut(); router.push("/login"); }
      else { toast.error(j.error || "Échec"); setDeleting(false); }
    } catch { toast.error("Erreur"); setDeleting(false); }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{t("set.title")}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t("set.subtitle")}</p>
      </header>

      <div className="flex flex-col gap-6 md:flex-row">
        {/* Rail d'onglets */}
        <nav className="flex gap-1.5 overflow-x-auto pb-1 md:w-56 md:flex-shrink-0 md:flex-col md:overflow-visible md:pb-0">
          {TABS.map((tb) => {
            const active = tab === tb.k;
            return (
              <button key={tb.k} onClick={() => setTab(tb.k)}
                className={`flex flex-shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors ${active ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}>
                <tb.icon className="h-[18px] w-[18px] flex-shrink-0" /> {t(tb.tk)}
              </button>
            );
          })}
        </nav>

        {/* Contenu */}
        <div className="min-w-0 flex-1 space-y-5">
          {tab === "profil" && (
            <>
              <Card title={t("set.photo.title")} desc={t("set.photo.desc")}>
                <div className="flex items-center gap-5">
                  <span className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-2xl font-bold ring-4 ring-zinc-50" style={{ background: ac.bg, color: ac.fg }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : (fullName.charAt(0).toUpperCase() || "?")}
                  </span>
                  <div>
                    <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }} />
                    <button onClick={() => fileRef.current?.click()} disabled={uploadingAvatar}
                      className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-3.5 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50">
                      {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} {t("set.photo.change")}
                    </button>
                    <p className="mt-1.5 text-xs text-zinc-400">{t("set.photo.hint")}</p>
                  </div>
                </div>
              </Card>

              <Card title={t("set.color.title")} desc={t("set.color.desc")}>
                <div className="flex items-center gap-4">
                  <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-xl font-bold ring-4 ring-zinc-50" style={{ background: ac.bg, color: ac.fg }}>{(fullName.charAt(0) || "?").toUpperCase()}</span>
                  <div className="flex flex-wrap gap-2.5">
                    {AVATAR_COLORS.map((cc) => {
                      const active = cc.key === color;
                      return (
                        <button key={cc.key} title={cc.label} aria-label={cc.label}
                          onClick={() => { setColor(cc.key); saveSettings({ avatarColor: cc.key }, t("toast.color")); }}
                          className={`flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-110 ${active ? "ring-2 ring-zinc-900 ring-offset-2" : ""}`}
                          style={{ background: cc.bg }}>
                          {active && <Check className="h-4 w-4" style={{ color: cc.fg }} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Card>

              <Card title={t("set.identity")}>
                <div className="space-y-4">
                  <Field label={t("set.fullname")}><input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} /></Field>
                  <Field label={t("set.email")}><input value={email} disabled className={inputCls + " cursor-not-allowed opacity-60"} /></Field>
                  <p className="text-xs text-zinc-400">{t("set.emailHint")}</p>
                  <div className="flex items-center gap-3">
                    <button onClick={saveProfile} disabled={savingProfile} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50">{savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {t("set.save")}</button>
                    <Link href="/dashboard/profile" className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:underline">{t("set.fullProfile")} <ChevronRight className="h-4 w-4" /></Link>
                  </div>
                </div>
              </Card>
            </>
          )}

          {tab === "securite" && (
            <>
              <Card title={t("set.pwd.title")} desc={t("set.pwd.desc")}>
                <div className="max-w-sm space-y-4">
                  <Field label={t("set.pwd.new")}><div className="relative"><Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-300" /><input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} className={inputCls + " pl-9"} placeholder="••••••••" autoComplete="new-password" /></div></Field>
                  <Field label={t("set.pwd.confirm")}><div className="relative"><Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-300" /><input type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} className={inputCls + " pl-9"} placeholder="••••••••" autoComplete="new-password" /></div></Field>
                  <button onClick={savePassword} disabled={savingPwd || !pwd || !pwd2} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50">{savingPwd ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />} {t("set.pwd.update")}</button>
                </div>
              </Card>

              <Card title={t("set.email.title")} desc={t("set.email.desc")}>
                <div className="flex max-w-md flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1"><Field label={t("set.email.new")}><div className="relative"><Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-300" /><input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={inputCls + " pl-9"} placeholder="email@email.com" /></div></Field></div>
                  <button onClick={saveEmail} disabled={savingEmail || !newEmail} className="inline-flex h-[42px] items-center gap-2 rounded-xl border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50">{savingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : t("set.email.send")}</button>
                </div>
              </Card>

              <Card title={t("set.session")}>
                <button onClick={signOut} className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-red-50 hover:text-red-600"><LogOut className="h-4 w-4" /> {t("set.logout")}</button>
              </Card>
            </>
          )}

          {tab === "notifications" && (
            <>
              <Card title={t("set.notif.title")} desc={t("set.notif.desc")}>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-zinc-50 p-4">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-10 w-10 items-center justify-center rounded-full ${perm === "granted" ? "bg-emerald-100 text-emerald-600" : "bg-zinc-200 text-zinc-500"}`}><BellRing className="h-5 w-5" /></span>
                    <div>
                      <div className="text-sm font-semibold text-zinc-800">{perm === "granted" ? t("set.notif.on") : perm === "denied" ? t("set.notif.blocked") : perm === "unsupported" ? t("set.notif.unsupported") : t("set.notif.off")}</div>
                      <div className="text-xs text-zinc-400">{perm === "denied" ? t("set.notif.hintBlocked") : perm === "granted" ? t("set.notif.hintOn") : t("set.notif.hintEnable")}</div>
                    </div>
                  </div>
                  {perm !== "granted" && perm !== "unsupported" && perm !== "denied" && <button onClick={askPermission} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">{t("set.notif.enable")}</button>}
                  {perm === "granted" && <Check className="h-5 w-5 text-emerald-600" />}
                </div>
              </Card>

              <Card title={t("set.sound.title")} desc={t("set.sound.desc")}>
                <button onClick={toggleSound} className="flex w-full items-center justify-between gap-3 rounded-xl bg-zinc-50 p-4 text-left transition-colors hover:bg-zinc-100">
                  <span className="flex items-center gap-3">
                    <span className={`flex h-10 w-10 items-center justify-center rounded-full ${sound ? "bg-emerald-100 text-emerald-600" : "bg-zinc-200 text-zinc-400"}`}>{sound ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}</span>
                    <span className="text-sm font-semibold text-zinc-800">{t("set.sound.label")}</span>
                  </span>
                  <span className={`relative h-6 w-11 rounded-full transition-colors ${sound ? "bg-emerald-500" : "bg-zinc-300"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${sound ? "left-[22px]" : "left-0.5"}`} /></span>
                </button>
              </Card>
            </>
          )}

          {tab === "preferences" && (
            <>
              <Card title={t("set.units.title")} desc={t("set.units.desc")}>
                <div className="inline-flex rounded-xl border border-zinc-200 p-1">
                  {(["metric", "imperial"] as const).map((k) => (
                    <button key={k} onClick={() => { setUnits(k); saveSettings({ unitSystem: k }, t("toast.units")); }}
                      className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${units === k ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}>
                      {k === "metric" ? t("set.units.km") : t("set.units.mi")}
                    </button>
                  ))}
                </div>
              </Card>

              <Card title={t("set.week.title")} desc={t("set.week.desc")}>
                <div className="inline-flex rounded-xl border border-zinc-200 p-1">
                  {(["mon", "sun"] as const).map((k) => (
                    <button key={k} onClick={() => { setWeekStart(k); saveSettings({ weekStart: k }, t("toast.saved")); }}
                      className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${weekStart === k ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}>
                      {k === "mon" ? t("set.week.mon") : t("set.week.sun")}
                    </button>
                  ))}
                </div>
              </Card>

              <Card title={t("set.lang.title")} desc={t("set.lang.desc")}>
                <div className="max-w-xs">
                  <Field label={t("set.lang.label")}>
                    <select value={lang} onChange={(e) => changeLang(e.target.value as Lang)} className={inputCls}>
                      {languageOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.flag} {o.label}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </Card>
            </>
          )}

          {tab === "connexions" && (
            <Card title={t("set.conn.title")} desc={t("set.conn.desc")}>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-900 text-white"><Watch className="h-5 w-5" /></span>
                  <div>
                    <div className="text-sm font-bold text-zinc-900">intervals.icu / Garmin</div>
                    <div className={`text-xs font-semibold ${intervalsOn ? "text-emerald-600" : "text-zinc-400"}`}>{intervalsOn ? `● ${t("set.conn.connected")}` : `○ ${t("set.conn.disconnected")}`}</div>
                  </div>
                </div>
                <Link href="/dashboard/sync" className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3.5 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50">{intervalsOn ? t("set.conn.manage") : t("set.conn.connect")} <ExternalLink className="h-3.5 w-3.5" /></Link>
              </div>
            </Card>
          )}

          {tab === "compte" && (
            <>
              <Card title={t("set.sub.title")}>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 p-4 ring-1 ring-emerald-100">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-emerald-700">{t("set.sub.current")}</div>
                    <div className="text-lg font-bold capitalize text-zinc-900">{tier === "free" ? t("set.sub.free") : tier}</div>
                  </div>
                  <CreditCard className="h-7 w-7 text-emerald-400" />
                </div>
                {createdAt && <p className="mt-3 text-xs text-zinc-400">{t("set.sub.since")} {new Date(createdAt).toLocaleDateString(lang, { day: "numeric", month: "long", year: "numeric" })}.</p>}
              </Card>

              <Card title={t("set.danger.title")} desc={t("set.danger.desc")}>
                <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
                    <div className="flex-1">
                      <div className="text-sm font-bold text-red-800">{t("set.danger.delete")}</div>
                      <p className="mt-0.5 text-xs text-red-600"><b>SUPPRIMER</b> {t("set.danger.confirm")}</p>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <input value={delText} onChange={(e) => setDelText(e.target.value)} placeholder="SUPPRIMER" className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 sm:w-48" />
                        <button onClick={deleteAccount} disabled={delText !== "SUPPRIMER" || deleting} className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40">{deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} {t("set.danger.cta")}</button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
