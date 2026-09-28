"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOfficeContext, isCustomerId } from "@/lib/customers/data";
import {
  type CustomerActionState,
  hasCustomerErrors,
  validateCustomer,
} from "@/lib/customers/validation";
import { createClient } from "@/lib/supabase/server";

function customerRpcFields(data: ReturnType<typeof validateCustomer>["data"]) {
  return {
    p_address_line_1: data.addressLine1,
    p_address_line_2: data.addressLine2,
    p_city: data.city,
    p_email: data.email,
    p_first_name: data.firstName,
    p_last_name: data.lastName,
    p_notes: data.notes,
    p_phone: data.phone,
    p_postcode: data.postcode,
    p_suburb: data.suburb,
  };
}

export async function createCustomerAction(
  _previousState: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const { data, fieldErrors } = validateCustomer(formData);
  if (hasCustomerErrors(fieldErrors)) return { fieldErrors, status: "error" };

  const { organization } = await requireOfficeContext();
  const supabase = await createClient();
  const result = await supabase.rpc("create_customer", {
    p_organization_id: organization.id,
    ...customerRpcFields(data),
  });

  if (result.error || typeof result.data !== "string") {
    return { message: "KiwiOps could not create this customer. Please try again.", status: "error" };
  }

  revalidatePath("/customers");
  redirect(`/customers/${result.data}?notice=created`);
}

export async function updateCustomerAction(
  customerId: string,
  _previousState: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  if (!isCustomerId(customerId)) return { message: "This customer could not be found.", status: "error" };
  const { data, fieldErrors } = validateCustomer(formData);
  if (hasCustomerErrors(fieldErrors)) return { fieldErrors, status: "error" };

  await requireOfficeContext();
  const supabase = await createClient();
  const result = await supabase.rpc("update_customer", {
    p_customer_id: customerId,
    ...customerRpcFields(data),
  });

  if (result.error) {
    return { message: "KiwiOps could not update this customer. Check your access and try again.", status: "error" };
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  redirect(`/customers/${customerId}?notice=updated`);
}

export async function setCustomerArchivedAction(
  _previousState: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const customerId = formData.get("customerId");
  const archived = formData.get("archived") === "true";
  if (typeof customerId !== "string" || !isCustomerId(customerId)) {
    return { message: "This customer could not be found.", status: "error" };
  }

  await requireOfficeContext();
  const supabase = await createClient();
  const result = await supabase.rpc("set_customer_archived", {
    p_archived: archived,
    p_customer_id: customerId,
  });

  if (result.error) {
    return { message: `KiwiOps could not ${archived ? "archive" : "restore"} this customer. Please try again.`, status: "error" };
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  redirect(`/customers/${customerId}?notice=${archived ? "archived" : "restored"}`);
}
