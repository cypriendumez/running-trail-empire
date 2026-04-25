export const dynamic = "force-dynamic";
import { SmartJournal } from "@/components/journal/SmartJournal";

export const metadata = { title: "Journal" };

export default function JournalPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <SmartJournal />
    </div>
  );
}
