import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getViewerContext } from "@/lib/auth/context";

export const dynamic = "force-dynamic";

export default async function ProtectedAppLayout({ children }: LayoutProps<"/">) {
  const viewer = await getViewerContext();
  if (!viewer) redirect("/login");
  if (!viewer.organization) redirect("/onboarding");

  return <AppShell viewer={{
    initials: viewer.initials,
    name: viewer.name,
    organizationName: viewer.organization.name,
    role: viewer.organization.role,
  }}>{children}</AppShell>;
}
