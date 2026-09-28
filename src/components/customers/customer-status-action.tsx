"use client";

import { Archive, RotateCcw, X } from "lucide-react";
import { useId, useRef, useActionState } from "react";
import { setCustomerArchivedAction } from "@/app/actions/customers";
import { initialCustomerState } from "@/lib/customers/validation";

export function CustomerStatusAction({ archived, customerId, customerName }: {
  archived: boolean;
  customerId: string;
  customerName: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const detailId = useId();
  const [state, action, pending] = useActionState(setCustomerArchivedAction, initialCustomerState);
  const verb = archived ? "Restore" : "Archive";

  return (
    <>
      <button className={`button ${archived ? "button-secondary" : "button-danger"}`} onClick={() => dialogRef.current?.showModal()} ref={triggerRef} type="button">
        {archived ? <RotateCcw aria-hidden="true" size={16} /> : <Archive aria-hidden="true" size={16} />}{verb}
      </button>
      <dialog aria-describedby={detailId} aria-labelledby={titleId} aria-modal="true" className="confirm-dialog" onClose={() => triggerRef.current?.focus()} ref={dialogRef}>
        <div className="dialog-heading">
          <div><p className="eyebrow">Confirm change</p><h2 id={titleId}>{verb} {customerName}?</h2></div>
          <button aria-label="Close confirmation" className="icon-button" onClick={() => dialogRef.current?.close()} type="button"><X aria-hidden="true" size={18} /></button>
        </div>
        <p id={detailId}>{archived
          ? "The customer will return to the active list and can be used in normal office workflows."
          : "Archived customers are hidden from the active list while their record and historical business data are retained."}</p>
        {state.message ? <p aria-live="polite" className="form-message form-message-error">{state.message}</p> : null}
        <form action={action} className="dialog-actions">
          <input name="customerId" type="hidden" value={customerId} />
          <input name="archived" type="hidden" value={String(!archived)} />
          <button className="button button-secondary" onClick={() => dialogRef.current?.close()} type="button">Cancel</button>
          <button className={`button ${archived ? "button-primary" : "button-danger"}`} disabled={pending} type="submit">
            {pending ? (archived ? "Restoring..." : "Archiving...") : `${verb} customer`}
          </button>
        </form>
      </dialog>
    </>
  );
}
