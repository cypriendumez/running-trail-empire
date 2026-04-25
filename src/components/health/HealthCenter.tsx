"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Heart, Utensils, Activity, AlertTriangle,
  Phone, MapPin, CheckCircle2, ChevronRight, Zap, Droplets
} from "lucide-react";
import { toast } from "sonner";

const BODY_PARTS = [
  { id: "head", label: "Tête", x: 48, y: 5, w: 10 },
  { id: "neck", label: "Cou", x: 48, y: 13, w: 5 },
  { id: "left_shoulder", label: "Épaule G", x: 35, y: 16, w: 7 },
  { id: "right_shoulder", label: "Épaule D", x: 60, y: 16, w: 7 },
  { id: "chest", label: "Poitrine", x: 48, y: 22, w: 12 },
  { id: "upper_back", label: "Haut dos", x: 48, y: 22, w: 12 },
  { id: "lower_back", label: "Bas dos", x: 48, y: 30, w: 10 },
  { id: "left_hip", label: "Hanche G", x: 40, y: 35, w: 7 },
  { id: "right_hip", label: "Hanche D", x: 57, y: 35, w: 7 },
  { id: "left_quad", label: "Quadriceps G", x: 40, y: 48, w: 7 },
  { id: "right_quad", label: "Quadriceps D", x: 57, y: 48, w: 7 },
  { id: "left_hamstring", label: "Ischio G", x: 40, y: 55, w: 7 },
  { id: "right_hamstring", label: "Ischio D", x: 57, y: 55, w: 7 },
  { id: "left_knee", label: "Genou G", x: 40, y: 62, w: 6 },
  { id: "right_knee", label: "Genou D", x: 57, y: 62, w: 6 },
  { id: "left_calf", label: "Mollet G", x: 40, y: 71, w: 6 },
  { id: "right_calf", label: "Mollet D", x: 57, y: 71, w: 6 },
  { id: "left_ankle", label: "Cheville G", x: 40, y: 80, w: 5 },
  { id: "right_ankle", label: "Cheville D", x: 57, y: 80, w: 5 },
  { id: "left_foot", label: "Pied G", x: 40, y: 88, w: 6 },
  { id: "right_foot", label: "Pied D", x: 57, y: 88, w: 6 },
  { id: "left_it_band", label: "Bandelette G", x: 36, y: 58, w: 5 },
  { id: "right_it_band", label: "Bandelette D", x: 60, y: 58, w: 5 },
];

const REHAB_PROTOCOLS: Record<string, Array<{name: string; sets: number; reps: number; desc: string}>> = {
  left_knee: [
    { name: "Squat isométrique mur", sets: 3, reps: 45, desc: "Dos au mur, cuisses parallèles au sol - 45 secondes" },
    { name: "Claquements fessiers", sets: 3, reps: 15, desc: "Allongé sur le dos, bridge + abduction" },
    { name: "Mollets excentrique", sets: 3, reps: 15, desc: "Descente lente sur marche - contrôle excentrique" },
  ],
  right_knee: [
    { name: "Squat isométrique mur", sets: 3, reps: 45, desc: "Dos au mur, cuisses parallèles au sol" },
    { name: "Claquements fessiers", sets: 3, reps: 15, desc: "Allongé sur le dos, bridge + abduction" },
  ],
  lower_back: [
    { name: "Cat-Cow stretch", sets: 3, reps: 10, desc: "À quatre pattes, flexion/extension de la colonne" },
    { name: "Renforcement gainage", sets: 3, reps: 30, desc: "Planche frontale - maintien 30 secondes" },
    { name: "Étirement psoas", sets: 2, reps: 30, desc: "Fente basse - étirement 30 secondes chaque côté" },
  ],
  left_it_band: [
    { name: "Étirement bandelette", sets: 3, reps: 45, desc: "Appui contre le mur, croisement des jambes" },
    { name: "Foam roller bandelette", sets: 2, reps: 60, desc: "Rouler lentement de la hanche au genou" },
  ],
  right_it_band: [
    { name: "Étirement bandelette", sets: 3, reps: 45, desc: "Appui contre le mur, croisement des jambes" },
    { name: "Foam roller bandelette", sets: 2, reps: 60, desc: "Rouler lentement de la hanche au genou" },
  ],
};

const DEFAULT_REHAB = [
  { name: "Mobilité articulaire", sets: 2, reps: 10, desc: "Rotations douces de l'articulation concernée" },
  { name: "Compression + élévation", sets: 1, reps: 20, desc: "Protocole PEACE & LOVE - repos actif recommandé" },
];

export function HealthCenter() {
  const [tab, setTab] = useState<"physio" | "guardian" | "nutrition">("physio");
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [painLevel, setPainLevel] = useState(5);
  const [guardianEnabled, setGuardianEnabled] = useState(false);
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [raceHours, setRaceHours] = useState(6);
  const [raceTemp, setRaceTemp] = useState(15);

  const selectedPartInfo = BODY_PARTS.find(p => p.id === selectedPart);
  const rehabProtocol = selectedPart ? (REHAB_PROTOCOLS[selectedPart] ?? DEFAULT_REHAB) : [];

  const carbsPerHour = Math.round(40 + (raceHours > 3 ? (raceHours - 3) * 5 : 0));
  const hydrationPerHour = Math.round(500 + (raceTemp - 15) * 20);

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-zinc-100 rounded-2xl w-fit">
        {[
          { v: "physio", l: "🩺 Physio-IA", icon: Activity },
          { v: "guardian", l: "🛡️ Guardian Mode", icon: Shield },
          { v: "nutrition", l: "🥗 Nutrition Lab", icon: Utensils },
        ].map(t => (
          <button key={t.v} onClick={() => setTab(t.v as typeof tab)}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${tab === t.v ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>
            {t.l}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === "physio" && (
          <motion.div key="physio" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="grid grid-cols-12 gap-4">

            {/* Body diagram */}
            <div className="col-span-12 md:col-span-5 bento-card">
              <h3 className="font-semibold text-zinc-900 mb-4">Schéma Corporel — Cliquez sur la zone douloureuse</h3>
              <div className="relative mx-auto" style={{ width: 200, height: 420 }}>
                {/* Body silhouette */}
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  {/* Simple body outline */}
                  <ellipse cx="50" cy="10" rx="8" ry="8" fill="#E4E4E7" stroke="#D4D4D8" strokeWidth="0.5" />
                  <rect x="38" y="17" width="24" height="22" rx="3" fill="#E4E4E7" stroke="#D4D4D8" strokeWidth="0.5" />
                  <rect x="25" y="18" width="13" height="18" rx="3" fill="#E4E4E7" stroke="#D4D4D8" strokeWidth="0.5" />
                  <rect x="62" y="18" width="13" height="18" rx="3" fill="#E4E4E7" stroke="#D4D4D8" strokeWidth="0.5" />
                  <rect x="40" y="38" width="8" height="28" rx="3" fill="#E4E4E7" stroke="#D4D4D8" strokeWidth="0.5" />
                  <rect x="52" y="38" width="8" height="28" rx="3" fill="#E4E4E7" stroke="#D4D4D8" strokeWidth="0.5" />
                  <rect x="40" y="65" width="8" height="22" rx="3" fill="#E4E4E7" stroke="#D4D4D8" strokeWidth="0.5" />
                  <rect x="52" y="65" width="8" height="22" rx="3" fill="#E4E4E7" stroke="#D4D4D8" strokeWidth="0.5" />
                  {/* Clickable hotspots */}
                  {BODY_PARTS.map(part => (
                    <circle
                      key={part.id}
                      cx={part.x}
                      cy={part.y + 2}
                      r={part.w / 2}
                      fill={selectedPart === part.id ? "#22c55e" : "rgba(34,197,94,0.1)"}
                      stroke={selectedPart === part.id ? "#16a34a" : "rgba(34,197,94,0.3)"}
                      strokeWidth="0.5"
                      className="cursor-pointer transition-all hover:fill-green-200"
                      onClick={() => setSelectedPart(selectedPart === part.id ? null : part.id)}
                    />
                  ))}
                </svg>
              </div>
              <p className="text-xs text-zinc-400 text-center mt-2">
                {selectedPart ? `Zone sélectionnée : ${selectedPartInfo?.label}` : "Cliquez sur une zone pour signaler une douleur"}
              </p>
            </div>

            {/* Diagnosis panel */}
            <div className="col-span-12 md:col-span-7 space-y-4">
              {selectedPart ? (
                <>
                  <div className="bento-card">
                    <div className="flex items-center gap-2 mb-4">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      <h3 className="font-semibold text-zinc-900">Douleur : {selectedPartInfo?.label}</h3>
                    </div>
                    <div className="mb-4">
                      <label className="text-xs font-medium text-zinc-500 block mb-2">
                        Niveau de douleur : {painLevel}/10
                      </label>
                      <input type="range" min="1" max="10" value={painLevel}
                        onChange={e => setPainLevel(parseInt(e.target.value))}
                        className="w-full accent-red-500" />
                      <div className="flex justify-between text-xs text-zinc-400 mt-1">
                        <span>Léger</span><span>Intense</span>
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl border text-sm"
                      style={{
                        backgroundColor: painLevel <= 3 ? "#f0fdf4" : painLevel <= 6 ? "#fffbeb" : "#fef2f2",
                        borderColor: painLevel <= 3 ? "#bbf7d0" : painLevel <= 6 ? "#fde68a" : "#fecaca",
                      }}>
                      <div className="font-semibold mb-1">
                        {painLevel <= 3 ? "🟢 Gestion possible" : painLevel <= 6 ? "🟡 Surveiller de près" : "🔴 Repos obligatoire"}
                      </div>
                      <div className="text-zinc-600">
                        {painLevel <= 3
                          ? "Protocole PEACE & LOVE applicable. Continuez avec prudence en Z1-Z2."
                          : painLevel <= 6
                          ? "Réduisez l'intensité. Consultez un kiné sous 48h si la douleur persiste."
                          : "Arrêt immédiat de la course recommandé. Consultez un médecin du sport."}
                      </div>
                    </div>
                  </div>

                  {rehabProtocol.length > 0 && (
                    <div className="bento-card">
                      <h3 className="font-semibold text-zinc-900 mb-4">Programme de Rééducation</h3>
                      <div className="space-y-3">
                        {rehabProtocol.map((ex, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-zinc-50 rounded-2xl">
                            <div className="w-7 h-7 bg-zinc-200 rounded-xl flex items-center justify-center text-xs font-bold text-zinc-700 flex-shrink-0">
                              {i + 1}
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-zinc-900 text-sm">{ex.name}</div>
                              <div className="text-xs text-zinc-500 mt-0.5">{ex.desc}</div>
                              <div className="flex gap-2 mt-1.5">
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md">{ex.sets} séries</span>
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-md">{ex.reps} reps/sec</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="bento-card text-center py-12">
                  <Heart className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
                  <p className="text-zinc-400">Sélectionnez une zone douloureuse sur le schéma corporel</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {tab === "guardian" && (
          <motion.div key="guardian" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="grid grid-cols-2 gap-4">

            <div className="bento-card col-span-2 md:col-span-1">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-semibold text-zinc-900 text-lg">Guardian Mode</h3>
                  <p className="text-sm text-zinc-500 mt-1">Sécurité active en course</p>
                </div>
                <button onClick={() => { setGuardianEnabled(!guardianEnabled); toast.success(guardianEnabled ? "Guardian désactivé" : "Guardian activé !"); }}
                  className={`w-14 h-7 rounded-full transition-all duration-300 ${guardianEnabled ? "bg-green-500" : "bg-zinc-200"}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300 mx-1 ${guardianEnabled ? "translate-x-7" : "translate-x-0"}`} />
                </button>
              </div>

              {guardianEnabled && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-2xl mb-4">
                  <div className="flex items-center gap-2 text-green-700 font-semibold text-sm">
                    <Shield className="w-4 h-4" />
                    Guardian actif — Surveillance en temps réel
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    Détection de chute · Arrêt cardiaque · Alerte GPS automatique
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {[
                  { icon: "🤸", label: "Détection de chute", desc: "Accéléromètre + gyroscope" },
                  { icon: "❤️", label: "Arrêt cardiaque", desc: "Via montre connectée (HRV)" },
                  { icon: "📍", label: "Position GPS live", desc: "Partagée avec les contacts d'urgence" },
                  { icon: "📞", label: "Alerte automatique", desc: "SMS + appel si pas de réponse en 2 min" },
                ].map(f => (
                  <div key={f.label} className="flex items-center gap-3">
                    <span className="text-lg">{f.icon}</span>
                    <div>
                      <div className="text-sm font-medium text-zinc-900">{f.label}</div>
                      <div className="text-xs text-zinc-500">{f.desc}</div>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" />
                  </div>
                ))}
              </div>
            </div>

            <div className="bento-card col-span-2 md:col-span-1">
              <h3 className="font-semibold text-zinc-900 mb-4">Contact d&apos;urgence</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-zinc-500 block mb-1">Prénom Nom</label>
                  <input value={emergencyName} onChange={e => setEmergencyName(e.target.value)}
                    placeholder="Jean Dupont"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-500 block mb-1">Téléphone</label>
                  <input value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)}
                    placeholder="+33 6 12 34 56 78" type="tel"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <button onClick={() => toast.success("Contact sauvegardé !")} className="btn-brand w-full justify-center">
                  <Phone className="w-4 h-4" />
                  Enregistrer le contact
                </button>
              </div>

              <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-2xl">
                <div className="flex items-center gap-2 text-red-700 font-semibold text-sm mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  Test de l&apos;alerte
                </div>
                <button onClick={() => toast("Test envoyé à votre contact d'urgence", { icon: "📱" })}
                  className="btn-secondary w-full justify-center text-sm mt-2">
                  Envoyer un message test
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {tab === "nutrition" && (
          <motion.div key="nutrition" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="grid grid-cols-2 gap-4">

            <div className="bento-card col-span-2">
              <h3 className="font-semibold text-zinc-900 mb-4">Nutrition Lab — Stratégie de Course</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-zinc-500 block mb-1">Durée de l&apos;épreuve (heures)</label>
                    <input type="range" min="1" max="24" step="0.5" value={raceHours}
                      onChange={e => setRaceHours(parseFloat(e.target.value))}
                      className="w-full accent-green-500" />
                    <div className="text-sm font-semibold text-zinc-900 mt-1">{raceHours}h</div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-500 block mb-1">Température prévue (°C)</label>
                    <input type="range" min="0" max="40" step="1" value={raceTemp}
                      onChange={e => setRaceTemp(parseInt(e.target.value))}
                      className="w-full accent-orange-500" />
                    <div className="text-sm font-semibold text-zinc-900 mt-1">{raceTemp}°C</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 text-center">
                    <Zap className="w-6 h-6 text-orange-500 mx-auto mb-2" />
                    <div className="text-3xl font-bold text-orange-600">{carbsPerHour}</div>
                    <div className="text-xs text-zinc-500 mt-1">g glucides/h</div>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-center">
                    <Droplets className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                    <div className="text-3xl font-bold text-blue-600">{hydrationPerHour}</div>
                    <div className="text-xs text-zinc-500 mt-1">ml eau/h</div>
                  </div>
                  <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 text-center">
                    <span className="text-xl">🧂</span>
                    <div className="text-3xl font-bold text-purple-600">
                      {Math.round(500 + raceTemp * 10)}
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">mg sodium/h</div>
                  </div>
                  <div className="bg-green-50 border border-green-100 rounded-2xl p-4 text-center">
                    <span className="text-xl">☕</span>
                    <div className="text-3xl font-bold text-green-600">
                      {raceHours >= 3 ? Math.round(raceHours * 20) : "—"}
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">mg caféine total</div>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <div className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-3">Plan de ravitaillement</div>
                <div className="space-y-2">
                  {Array.from({ length: Math.min(Math.ceil(raceHours), 8) }, (_, i) => ({
                    h: i + 1,
                    carbs: carbsPerHour,
                    water: hydrationPerHour,
                    food: i === 0 ? "Gel énergétique + eau" :
                          i % 2 === 0 ? "Barre + compote + eau" :
                          "Gel + eau + électrolytes",
                  })).map(cp => (
                    <div key={cp.h} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-2xl text-sm">
                      <span className="w-10 text-zinc-400 font-medium">H+{cp.h}</span>
                      <span className="flex-1 text-zinc-700">{cp.food}</span>
                      <span className="text-xs text-orange-600 font-medium">{cp.carbs}g</span>
                      <span className="text-xs text-blue-600 font-medium">{cp.water}ml</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
