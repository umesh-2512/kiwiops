"use client";

import { LogOut } from "lucide-react";
import { useFormStatus } from "react-dom";

export function SignOutButton() {
  const { pending } = useFormStatus();
  return (
    <button className="sign-out-button" disabled={pending} type="submit">
      <LogOut aria-hidden="true" size={15} />
      <span>{pending ? "Signing out..." : "Sign out"}</span>
    </button>
  );
}
