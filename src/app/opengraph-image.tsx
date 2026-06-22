import { ImageResponse } from "next/og";

// Aperçu social (lien partagé sur WhatsApp, X, LinkedIn, iMessage…). 1200×630.
export const alt = "Pacevo — Coaching IA, analyse VFC, Trail Builder";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "linear-gradient(135deg, #1C1C24 0%, #09090B 60%)",
          position: "relative",
        }}
      >
        {/* halo vert */}
        <div
          style={{
            position: "absolute",
            top: -160,
            left: -120,
            width: 520,
            height: 520,
            borderRadius: "50%",
            background: "radial-gradient(closest-side, rgba(52,211,153,0.30), rgba(52,211,153,0))",
            display: "flex",
          }}
        />

        {/* haut : logo + nom */}
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: 22,
              background: "linear-gradient(135deg, #1c6e56 0%, #0a3a2d 100%)",
              border: "1px solid rgba(255,255,255,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ color: "#fff", fontSize: 50, fontWeight: 800 }}>P</span>
          </div>
          <span style={{ color: "#fff", fontSize: 30, fontWeight: 700 }}>Pacevo</span>
        </div>

        {/* milieu : accroche */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ color: "#34d399", fontSize: 26, fontWeight: 700, letterSpacing: 2, marginBottom: 18 }}>
            L'APP RUNNING LA PLUS AVANCÉE · 2026
          </span>
          <span style={{ color: "#fff", fontSize: 92, fontWeight: 800, lineHeight: 1.0, letterSpacing: -2 }}>
            Courez plus loin.
          </span>
          <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 34, marginTop: 24, lineHeight: 1.3 }}>
            Coaching IA · Analyse VFC · Ghost Runner · Trail Builder SIG
          </span>
        </div>

        {/* bas : url + chips */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 26 }}>pacevo</span>
          <div style={{ display: "flex", gap: 12 }}>
            {["Garmin", "Coros", "intervals.icu"].map(s => (
              <span
                key={s}
                style={{
                  color: "rgba(255,255,255,0.7)",
                  fontSize: 22,
                  padding: "8px 18px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.15)",
                  display: "flex",
                }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
