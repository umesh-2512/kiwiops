export type CustomerFieldErrors = Record<string, string[]>;

export type CustomerActionState = {
  fieldErrors?: CustomerFieldErrors;
  message?: string;
  status: "idle" | "error" | "success";
};

export const initialCustomerState: CustomerActionState = { status: "idle" };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[+\d][\d\s().-]*$/;

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function addError(errors: CustomerFieldErrors, field: string, message: string) {
  errors[field] = [...(errors[field] ?? []), message];
}

function maxLength(errors: CustomerFieldErrors, field: string, value: string, max: number, label: string) {
  if (value.length > max) addError(errors, field, `${label} must be ${max} characters or fewer.`);
}

export function validateCustomer(formData: FormData) {
  const data = {
    firstName: textValue(formData, "firstName"),
    lastName: textValue(formData, "lastName"),
    email: textValue(formData, "email").toLowerCase(),
    phone: textValue(formData, "phone"),
    addressLine1: textValue(formData, "addressLine1"),
    addressLine2: textValue(formData, "addressLine2"),
    suburb: textValue(formData, "suburb"),
    city: textValue(formData, "city"),
    postcode: textValue(formData, "postcode"),
    notes: textValue(formData, "notes"),
  };
  const fieldErrors: CustomerFieldErrors = {};

  if (!data.firstName) addError(fieldErrors, "firstName", "Enter the customer’s first name.");
  if (!data.lastName) addError(fieldErrors, "lastName", "Enter the customer’s last name.");
  maxLength(fieldErrors, "firstName", data.firstName, 100, "First name");
  maxLength(fieldErrors, "lastName", data.lastName, 100, "Last name");

  if (data.email && !emailPattern.test(data.email)) addError(fieldErrors, "email", "Enter a valid email address.");
  maxLength(fieldErrors, "email", data.email, 254, "Email");

  if (data.phone && (data.phone.length < 7 || data.phone.length > 30 || !phonePattern.test(data.phone))) {
    addError(fieldErrors, "phone", "Enter a valid phone number between 7 and 30 characters.");
  }

  maxLength(fieldErrors, "addressLine1", data.addressLine1, 160, "Address line 1");
  maxLength(fieldErrors, "addressLine2", data.addressLine2, 160, "Address line 2");
  maxLength(fieldErrors, "suburb", data.suburb, 100, "Suburb");
  maxLength(fieldErrors, "city", data.city, 100, "City");
  maxLength(fieldErrors, "postcode", data.postcode, 20, "Postcode");
  maxLength(fieldErrors, "notes", data.notes, 5000, "Notes");

  return { data, fieldErrors };
}

export function hasCustomerErrors(errors: CustomerFieldErrors) {
  return Object.keys(errors).length > 0;
}
