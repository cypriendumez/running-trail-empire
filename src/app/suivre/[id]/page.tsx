import { LiveViewer } from "@/components/parcours/LiveViewer";

export const metadata = { title: "Suivi en direct · Running & Trail Empire" };

// Page publique (hors auth) : n'importe qui avec le lien suit le coureur en direct.
export default async function SuivrePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LiveViewer id={id} />;
}
