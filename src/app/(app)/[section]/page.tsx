import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModulePlaceholder } from "@/components/ui/module-placeholder";
import { modulePages } from "@/lib/navigation";

type SectionPageProps = { params: Promise<{ section: string }> };

export async function generateMetadata({ params }: SectionPageProps): Promise<Metadata> {
  const { section } = await params;
  const page = modulePages[section];
  return page ? { title: page.title } : {};
}

export default async function SectionPage({ params }: SectionPageProps) {
  const { section } = await params;
  const page = modulePages[section];
  if (!page) notFound();
  return <ModulePlaceholder {...page} />;
}
