"use server";

import { revalidatePath } from "next/cache";
import { requireSettingsContext } from "@/lib/settings/data";
import { hasSettingsErrors, type SettingsActionState, validateBusinessSettings } from "@/lib/settings/validation";
import { createClient } from "@/lib/supabase/server";

export async function updateBusinessSettingsAction(
  _state: SettingsActionState,
  form: FormData,
): Promise<SettingsActionState> {
  const { organization } = await requireSettingsContext();
  if (organization.role !== "owner") return { message: "Only the business owner can update these settings.", status: "error" };
  const { data, fieldErrors } = validateBusinessSettings(form);
  if (hasSettingsErrors(fieldErrors)) return { fieldErrors, status: "error" };

  const supabase = await createClient();
  const result = await supabase.rpc("update_business_settings", {
    p_organization_id: organization.id, p_expected_updated_at: data.expectedUpdatedAt,
    p_legal_name: data.legalName, p_trading_name: data.tradingName,
    p_business_email: data.businessEmail, p_business_phone: data.businessPhone || null,
    p_address_line_1: data.addressLine1, p_address_line_2: data.addressLine2 || null,
    p_suburb: data.suburb || null, p_city: data.city, p_postcode: data.postcode,
    p_nzbn: data.nzbn || null, p_gst_registered: data.gstRegistered,
    p_gst_number: data.gstNumber, p_currency: data.currency, p_timezone: data.timezone,
    p_invoice_payment_terms_days: data.paymentTerms,
  });
  if (result.error) {
    const message = result.error.message.includes("another user")
      ? "These settings changed in another session. Refresh before saving again."
      : "KiwiOps could not save these settings. Check the highlighted fields and try again.";
    return { message, status: "error" };
  }
  revalidatePath("/settings"); revalidatePath("/"); revalidatePath("/quotes"); revalidatePath("/invoices");
  return { message: "Business settings saved. Financial readiness has been updated.", status: "success" };
}
