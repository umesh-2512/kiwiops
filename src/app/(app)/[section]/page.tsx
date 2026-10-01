import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModulePlaceholder } from "@/components/ui/module-placeholder";
import { modulePages } from "@/lib/navigation";
import { getViewerContext } from "@/lib/auth/context";

type SectionPageProps = { params: Promise<{ section: string }> };

export async function generateMetadata({ params }: SectionPageProps): Promise<Metadata> {
  const { section } = await params;
  const page = modulePages[section];
  return page ? { title: page.title } : {};
}

export default async function SectionPage({ params }: SectionPageProps) {
  const { section } = await params;
  const page = modulePages[section];
  const viewer = await getViewerContext();
  if (!page || section === "jobs" || viewer?.organization?.role === "technician") notFound();
  return <ModulePlaceholder {...page} />;
}
