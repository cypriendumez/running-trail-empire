// Les textes du questionnaire d'aptitude (lib/health/aptitude), partagés par l'inscription et
// Santé — une seule source, 5 langues. Pur, sans module serveur : importable par un écran client.
import type { Lang } from "@/lib/i18n/translations";
import type { QuestionAptitude } from "@/lib/health/aptitude";

export const APTITUDE_UI: Record<Lang, {
  titre: string; aide: string; questions: Record<QuestionAptitude, string>; aucune: string;
  envoyer: string; attenteTitre: string; attente: string; avisBouton: string; avisAide: string;
  ok: string; okAttente: string; okAvis: string; recalcul: string; erreur: string;
}> = {
  fr: {
    titre: "Avant de t'entraîner fort", aide: "Coche ce qui t'est déjà arrivé. Ces questions ne posent aucun diagnostic : elles disent seulement quand voir un médecin avant les séances intenses.",
    questions: {
      poitrine: "Une douleur ou une gêne dans la poitrine pendant un effort",
      malaise: "Un malaise ou une perte de connaissance pendant ou juste après un effort",
      essoufflement: "Un essoufflement anormal à l'effort (plus qu'avant, ou que les gens de ton âge)",
      palpitations: "Des palpitations : un cœur qui bat très vite ou de façon irrégulière",
      avisContraire: "Un médecin t'a déjà dit d'éviter ou de limiter l'effort physique",
    },
    aucune: "Aucune de ces situations",
    envoyer: "Enregistrer mes réponses",
    attenteTitre: "Avis d'un médecin attendu",
    attente: "Tu as signalé une situation à faire voir à un médecin. En attendant son avis, ton plan ne contient aucune séance dure (footings, renforcement sans saut, sorties faciles). En cas de douleur dans la poitrine, de malaise ou d'essoufflement inhabituel : arrête-toi et appelle le 15 ou le 112.",
    avisBouton: "J'ai vu un médecin, il m'autorise à reprendre l'intensité",
    avisAide: "C'est toi qui le déclares : Pacevo ne reçoit aucun document médical.",
    ok: "Réponses enregistrées.", okAttente: "Réponses enregistrées : pas d'intensité en attendant l'avis d'un médecin.", okAvis: "C'est noté : les séances dures reviennent dans ton plan.",
    recalcul: "Ton plan en tiendra compte à son prochain recalcul.", erreur: "Réponses non enregistrées, réessaie dans un instant.",
  },
  en: {
    titre: "Before training hard", aide: "Tick anything that has happened to you. These questions make no diagnosis: they only tell you when to see a doctor before intense sessions.",
    questions: {
      poitrine: "Pain or discomfort in your chest during exercise",
      malaise: "Feeling faint or losing consciousness during or just after exercise",
      essoufflement: "Unusual breathlessness during exercise (more than before, or than people your age)",
      palpitations: "Palpitations: a heart beating very fast or irregularly",
      avisContraire: "A doctor has told you to avoid or limit physical exercise",
    },
    aucune: "None of these",
    envoyer: "Save my answers",
    attenteTitre: "Waiting for a doctor's opinion",
    attente: "You reported something a doctor should look at. Until then, your plan has no hard sessions (easy runs, strength work without jumps, easy long runs). If you get chest pain, feel faint or unusually breathless: stop and call 112.",
    avisBouton: "I have seen a doctor who allows me to train hard again",
    avisAide: "You declare it yourself: Pacevo receives no medical document.",
    ok: "Answers saved.", okAttente: "Answers saved: no intensity until a doctor has given an opinion.", okAvis: "Noted: hard sessions are back in your plan.",
    recalcul: "Your plan will take it into account at its next recalculation.", erreur: "Answers not saved, try again in a moment.",
  },
  de: {
    titre: "Bevor du intensiv trainierst", aide: "Kreuze an, was dir schon passiert ist. Diese Fragen stellen keine Diagnose: Sie sagen nur, wann du vor intensiven Einheiten zum Arzt solltest.",
    questions: {
      poitrine: "Schmerzen oder Druck in der Brust bei Belastung",
      malaise: "Schwächeanfall oder Bewusstlosigkeit während oder kurz nach einer Belastung",
      essoufflement: "Ungewöhnliche Atemnot bei Belastung (stärker als früher oder als bei Gleichaltrigen)",
      palpitations: "Herzrasen: ein sehr schneller oder unregelmäßiger Herzschlag",
      avisContraire: "Eine Ärztin oder ein Arzt hat dir geraten, körperliche Belastung zu vermeiden oder zu begrenzen",
    },
    aucune: "Nichts davon",
    envoyer: "Antworten speichern",
    attenteTitre: "Ärztliche Einschätzung ausstehend",
    attente: "Du hast etwas angegeben, das ärztlich abgeklärt werden sollte. Bis dahin enthält dein Plan keine harten Einheiten (lockere Läufe, Kraft ohne Sprünge, lockere lange Läufe). Bei Brustschmerz, Schwäche oder ungewöhnlicher Atemnot: aufhören und 112 anrufen.",
    avisBouton: "Ich war beim Arzt und darf wieder intensiv trainieren",
    avisAide: "Du erklärst es selbst: Pacevo erhält kein medizinisches Dokument.",
    ok: "Antworten gespeichert.", okAttente: "Antworten gespeichert: keine Intensität bis zur ärztlichen Einschätzung.", okAvis: "Notiert: Die harten Einheiten kommen zurück in deinen Plan.",
    recalcul: "Dein Plan berücksichtigt das bei der nächsten Neuberechnung.", erreur: "Antworten nicht gespeichert, versuche es gleich noch einmal.",
  },
  es: {
    titre: "Antes de entrenar fuerte", aide: "Marca lo que ya te haya pasado. Estas preguntas no hacen ningún diagnóstico: solo indican cuándo ver a un médico antes de las sesiones intensas.",
    questions: {
      poitrine: "Dolor o molestia en el pecho durante un esfuerzo",
      malaise: "Un mareo o una pérdida de conocimiento durante o justo después de un esfuerzo",
      essoufflement: "Una falta de aire anormal en el esfuerzo (más que antes, o que la gente de tu edad)",
      palpitations: "Palpitaciones: un corazón que late muy rápido o de forma irregular",
      avisContraire: "Un médico te ha dicho que evites o limites el esfuerzo físico",
    },
    aucune: "Ninguna de estas situaciones",
    envoyer: "Guardar mis respuestas",
    attenteTitre: "A la espera de la opinión de un médico",
    attente: "Has señalado algo que debe ver un médico. Hasta entonces, tu plan no tiene sesiones duras (rodajes, fuerza sin saltos, tiradas suaves). Si tienes dolor en el pecho, un mareo o una falta de aire inusual: para y llama al 112.",
    avisBouton: "He visto a un médico y me autoriza a volver a la intensidad",
    avisAide: "Lo declaras tú: Pacevo no recibe ningún documento médico.",
    ok: "Respuestas guardadas.", okAttente: "Respuestas guardadas: sin intensidad hasta la opinión de un médico.", okAvis: "Anotado: las sesiones duras vuelven a tu plan.",
    recalcul: "Tu plan lo tendrá en cuenta en su próximo recálculo.", erreur: "Respuestas no guardadas, inténtalo de nuevo en un momento.",
  },
  pt: {
    titre: "Antes de treinares forte", aide: "Assinala o que já te aconteceu. Estas perguntas não fazem nenhum diagnóstico: só indicam quando ver um médico antes dos treinos intensos.",
    questions: {
      poitrine: "Dor ou desconforto no peito durante um esforço",
      malaise: "Uma tontura ou perda de consciência durante ou logo após um esforço",
      essoufflement: "Uma falta de ar anormal no esforço (mais do que antes, ou do que pessoas da tua idade)",
      palpitations: "Palpitações: um coração a bater muito depressa ou de forma irregular",
      avisContraire: "Um médico já te disse para evitares ou limitares o esforço físico",
    },
    aucune: "Nenhuma destas situações",
    envoyer: "Guardar as minhas respostas",
    attenteTitre: "À espera da opinião de um médico",
    attente: "Assinalaste algo que um médico deve ver. Até lá, o teu plano não tem treinos duros (corridas fáceis, reforço sem saltos, treinos longos fáceis). Se sentires dor no peito, tontura ou falta de ar invulgar: para e liga 112.",
    avisBouton: "Já vi um médico e ele autoriza-me a voltar à intensidade",
    avisAide: "És tu que o declaras: o Pacevo não recebe nenhum documento médico.",
    ok: "Respostas guardadas.", okAttente: "Respostas guardadas: sem intensidade até à opinião de um médico.", okAvis: "Anotado: os treinos duros voltam ao teu plano.",
    recalcul: "O teu plano vai ter isso em conta no próximo recálculo.", erreur: "Respostas não guardadas, tenta novamente daqui a pouco.",
  },
};
