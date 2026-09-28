export type FieldErrors = Record<string, string[]>;

export type AuthActionState = {
  fieldErrors?: FieldErrors;
  message?: string;
  status: "idle" | "error" | "success";
};

export const initialAuthState: AuthActionState = { status: "idle" };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function rawTextValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function addError(errors: FieldErrors, field: string, message: string) {
  errors[field] = [...(errors[field] ?? []), message];
}

export function validateLogin(formData: FormData) {
  const email = textValue(formData, "email").toLowerCase();
  const password = rawTextValue(formData, "password");
  const fieldErrors: FieldErrors = {};

  if (!emailPattern.test(email)) addError(fieldErrors, "email", "Enter a valid email address.");
  if (!password) addError(fieldErrors, "password", "Enter your password.");

  return { data: { email, password }, fieldErrors };
}

export function validateSignup(formData: FormData) {
  const firstName = textValue(formData, "firstName");
  const lastName = textValue(formData, "lastName");
  const email = textValue(formData, "email").toLowerCase();
  const password = rawTextValue(formData, "password");
  const confirmPassword = rawTextValue(formData, "confirmPassword");
  const fieldErrors: FieldErrors = {};

  if (firstName.length < 2) addError(fieldErrors, "firstName", "Enter at least 2 characters.");
  if (lastName.length < 2) addError(fieldErrors, "lastName", "Enter at least 2 characters.");
  if (!emailPattern.test(email)) addError(fieldErrors, "email", "Enter a valid email address.");
  if (password.length < 10) addError(fieldErrors, "password", "Use at least 10 characters.");
  if (!/[A-Za-z]/.test(password)) addError(fieldErrors, "password", "Include at least one letter.");
  if (!/[0-9]/.test(password)) addError(fieldErrors, "password", "Include at least one number.");
  if (password !== confirmPassword) addError(fieldErrors, "confirmPassword", "Passwords do not match.");

  return { data: { email, firstName, lastName, password }, fieldErrors };
}

export function validateBusinessName(formData: FormData) {
  const businessName = textValue(formData, "businessName");
  const fieldErrors: FieldErrors = {};

  if (businessName.length < 2) addError(fieldErrors, "businessName", "Enter your business name.");
  if (businessName.length > 160) addError(fieldErrors, "businessName", "Keep the business name under 160 characters.");

  return { data: { businessName }, fieldErrors };
}

export function hasFieldErrors(errors: FieldErrors) {
  return Object.keys(errors).length > 0;
}
