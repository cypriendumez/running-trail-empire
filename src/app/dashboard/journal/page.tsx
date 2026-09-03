import { redirect } from "next/navigation";

export const metadata = { title: "Journal" };

// Le Journal a été intégré au hub Santé (onglet « Journal »).
export default function JournalPage() {
  redirect("/dashboard/health");
}
