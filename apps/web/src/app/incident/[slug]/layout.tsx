import { notFound } from "next/navigation";
import { loadIncidentConfig } from "@/lib/incident/config";
import { IncidentNav } from "@/components/incident/IncidentNav";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const config = await loadIncidentConfig(slug);
  if (!config) return {};
  return {
    title: `${config.title} — Exposure`,
    description: config.description,
    openGraph: {
      title: `${config.title} — Exposure`,
      description: config.description,
    },
  };
}

export default async function IncidentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const config = await loadIncidentConfig(slug);
  if (!config) notFound();

  return (
    <div className="min-h-screen bg-gray-50 text-black">
      <IncidentNav title={config.title} slug={config.slug} />
      <main>{children}</main>
    </div>
  );
}
