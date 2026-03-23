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
    icons: {
      icon: "/logos/icn/icn-usr.png",
    },
    metadataBase: new URL("https://exposure.forum"),
    openGraph: {
      title: `${config.title} — Exposure`,
      description: config.description,
      images: [
        {
          url: "https://exposure.forum/og/resolv.png",
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${config.title} — Exposure`,
      description: config.description,
      images: ["https://exposure.forum/og/resolv.png"],
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
      <IncidentNav
        title={config.title}
        lastUpdated={new Date().toISOString()}
      />
      <main>{children}</main>
    </div>
  );
}
