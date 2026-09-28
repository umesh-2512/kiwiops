export type CustomerStatus = "active" | "archived";

export type Customer = {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  suburb: string | null;
  city: string | null;
  postcode: string | null;
  notes: string | null;
  status: CustomerStatus;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerActivity = {
  id: string;
  action: string;
  summary: string;
  created_at: string;
};

export function customerDisplayName(customer: Pick<Customer, "first_name" | "last_name">) {
  return `${customer.first_name} ${customer.last_name}`.trim();
}

export function customerLocation(customer: Pick<Customer, "suburb" | "city">) {
  return [customer.suburb, customer.city].filter(Boolean).join(", ");
}
