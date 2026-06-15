import { redirect } from "next/navigation";

// Le Journal a été intégré au hub Santé (onglet « Journal »).
export default function JournalPage() {
  redirect("/dashboard/health");
}
