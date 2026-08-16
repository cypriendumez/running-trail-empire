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
          {/* Le « e » émeraude, comme dans le wordmark du site : l'aperçu partagé et la
              page doivent porter la même marque. C'est la lettre que « Pace » et « Evo »
              se partagent — voir components/brand/Wordmark.tsx. */}
          <span style={{ color: "#fff", fontSize: 30, fontWeight: 700, display: "flex" }}>
            Pac<span style={{ color: "#10d68a" }}>e</span>vo
          </span>
        </div>

        {/* milieu : accroche */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {/* Ce surtitre annonçait « L'APP RUNNING LA PLUS AVANCÉE · 2026 » : un superlatif
              que rien ne fonde, sur la SEULE image que voient WhatsApp, iMessage et X. La
              landing avait été purgée de ce genre d'affirmation, pas l'aperçu social.
              Remplacé par l'équation de marque, qui elle est vraie et explique le nom. */}
          <span style={{ color: "#34d399", fontSize: 26, fontWeight: 700, letterSpacing: 3, marginBottom: 18 }}>
            PACE + ÉVOLUTION
          </span>
          <span style={{ color: "#fff", fontSize: 78, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2, display: "flex", flexDirection: "column" }}>
            <span>Ton plan se réécrit.</span>
            <span style={{ display: "flex" }}>
              Toi,&nbsp;<span style={{ color: "#10d68a" }}>tu cours.</span>
            </span>
          </span>
          {/* Tenu sur UNE ligne : à 83 caractères, la phrase repartait à la ligne pour y
              laisser deux mots isolés, ce qui déséquilibrait le bas de l'image. */}
          <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 30, marginTop: 24, lineHeight: 1.3 }}>
            VFC, sommeil et charge relus à chaque synchro · Allures sur ta montre
          </span>
        </div>

        {/* bas : url + chips */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* Le nom figurait déjà en haut : le répéter ici ne disait rien. On met à la
              place les deux seuls chiffres du site qui soient VÉRIFIABLES — ceux du
              bandeau de la landing (`STAT_VALUES`), pas une promesse de plus. */}
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 26 }}>14 000+ courses · 15 700 parcours</span>
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
