/**
 * LE TEST VMA (6 MINUTES À FOND) EST-IL À ÉVITER POUR CE COUREUR ? — UNE seule règle, pour le bandeau
 * du test (`TestVmaBanner`, tableau de bord), le Profil et la fiche vitesse (17/11/2026).
 *
 * À éviter : l'avis d'un médecin est attendu (questionnaire d'aptitude), le coureur suit le programme
 * marche-course (le coach ne prescrit pas le test tant qu'il ne court pas 30 minutes d'affilée), ou
 * l'une des deux lectures est en panne — dans le doute, on ne pousse pas un effort maximal.
 * ⚠️ La VMA estimée, désormais affichée partout, ne doit pas emporter avec elle une invitation au test
 * vers ces coureurs-là (@HeadCoach, 17/11/2026). Le tableau de bord recopiait la règle et ignorait la
 * panne de l'état du coach : il appelle désormais `testVmaAEviterDe` avec ses propres lectures.
 */
import { TYPE_APTITUDE, lireAptitude, avisAttendu } from "@/lib/health/aptitude";

type Lecteur = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
type Lecture = { data?: unknown; error?: unknown };

/**
 * L'AVIS D'UN MÉDECIN EST-IL ATTENDU ? — la décision « pas de course » (carte « Avis médical attendu »
 * du tableau de bord), sur la seule lecture d'aptitude : avis attendu, ou questionnaire illisible.
 * ⚠️ DISTINCTE de « pas de test VMA » (`testVmaAEviterDe`), qui couvre AUSSI la marche-course et la panne
 * de l'état du coach : un coureur en marche-course DOIT courir (en alternance), il n'attend aucun
 * médecin. Les confondre affichait une fausse alerte de santé (@HeadCoach, @Maestro, 19/11/2026).
 */
export function avisMedicalEnAttenteDe(aptitude: Lecture): boolean {
  if (aptitude.error) return true;
  return avisAttendu(lireAptitude(((aptitude.data ?? []) as { data?: unknown }[])[0]?.data));
}

/**
 * La règle, sur deux lectures déjà faites : la dernière ligne d'aptitude (`notifications`, type
 * `aptitude`, liste) et l'état du coach (`notifications`, type `auto_coach_state`, une ligne).
 */
export function testVmaAEviterDe(aptitude: Lecture, etatCoach: Lecture): boolean {
  if (avisMedicalEnAttenteDe(aptitude) || etatCoach.error) return true;
  const marche = ((etatCoach.data as { data?: { marcheCourse?: { etape?: unknown } | null } } | null)?.data)?.marcheCourse;
  return typeof marche?.etape === "number";
}

/** La même règle, lectures comprises. */
export async function testVmaAEviter(sb: Lecteur, userId: string): Promise<boolean> {
  const [apt, etat] = await Promise.all([
    sb.from("notifications").select("data").eq("user_id", userId).eq("type", TYPE_APTITUDE).order("created_at", { ascending: false }).limit(1),
    sb.from("notifications").select("data").eq("user_id", userId).eq("type", "auto_coach_state").maybeSingle(),
  ]);
  return testVmaAEviterDe(apt, etat);
}
