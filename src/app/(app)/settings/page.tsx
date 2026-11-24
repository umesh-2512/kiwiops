import type { Metadata } from "next";
import { BusinessSettingsForm } from "@/components/settings/business-settings-form";
import { getBusinessSettings, requireSettingsContext } from "@/lib/settings/data";

export const metadata: Metadata = { title: "Business settings" };

export default async function SettingsPage() {
  const { organization } = await requireSettingsContext();
  const settings = await getBusinessSettings(organization.id);
  return <div className="page-stack settings-page"><section className="page-heading"><div><p className="eyebrow">Business configuration</p><h1>Business settings</h1><p className="page-description">Confirm the details and GST configuration KiwiOps uses for financial documents.</p></div></section><BusinessSettingsForm canEdit={organization.role === "owner"} settings={settings} /></div>;
}
