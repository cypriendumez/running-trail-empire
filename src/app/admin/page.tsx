import { AdminWorkflow } from "@/components/admin/AdminWorkflow";
import { Metadata } from "next";

export const metadata: Metadata = { title: "Admin – Running Elite" };

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-1">Admin Workflow</h1>
          <p className="text-zinc-400 text-sm">
            Générez les rapports Gemini Flash · Rédigez vos conseils Claude Pro · Publiez aux athlètes
          </p>
        </div>
        <AdminWorkflow />
      </div>
    </div>
  );
}
