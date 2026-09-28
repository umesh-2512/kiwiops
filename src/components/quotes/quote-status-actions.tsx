"use client";

import { X } from "lucide-react";
import { useActionState, useId, useRef } from "react";
import { issueQuoteAction, quoteOutcomeAction } from "@/app/actions/quotes";
import { initialQuoteState } from "@/lib/quotes/validation";

function StatusForm({ action, confirmText, detail, label, pendingLabel, tone = "primary" }: {
  action: (state: typeof initialQuoteState) => Promise<typeof initialQuoteState>;
  confirmText: string;
  detail: string;
  label: string;
  pendingLabel: string;
  tone?: "primary" | "secondary";
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const detailId = useId();
  const [state, formAction, pending] = useActionState(action, initialQuoteState);

  return <>
    <button className={`button button-${tone}`} onClick={() => dialog.current?.showModal()} ref={trigger} type="button">{label}</button>
    <dialog
      aria-describedby={detailId}
      aria-labelledby={titleId}
      aria-modal="true"
      className="confirm-dialog"
      onClose={() => trigger.current?.focus()}
      ref={dialog}
    >
      <div className="dialog-heading">
        <h2 id={titleId}>{confirmText}</h2>
        <button aria-label="Close confirmation" className="icon-button" onClick={() => dialog.current?.close()} type="button"><X aria-hidden="true" size={18} /></button>
      </div>
      <p id={detailId}>{detail}</p>
      <form action={formAction}>
        <div className="dialog-actions">
          <button className="button button-secondary" onClick={() => dialog.current?.close()} type="button">Cancel</button>
          <button className={`button button-${tone}`} disabled={pending} type="submit">{pending ? pendingLabel : label}</button>
        </div>
        {state.message ? <p className="form-message form-message-error" aria-live="polite">{state.message}</p> : null}
      </form>
    </dialog>
  </>;
}

export function QuoteStatusActions({ id, number, status }: { id: string; number: string; status: string }) {
  if (status === "draft") return <StatusForm action={issueQuoteAction.bind(null, id)} confirmText={`Issue quote ${number}?`} detail="Once issued, the quote's customer, enquiry, dates, line items, prices, notes, terms, and totals will be locked." label="Issue quote" pendingLabel="Issuing quote..." />;
  if (status === "sent") return <div className="detail-actions"><StatusForm action={quoteOutcomeAction.bind(null, id, "rejected")} confirmText={`Mark ${number} declined?`} detail="This records the customer's decision and cannot be reversed in the current workflow." label="Mark declined" pendingLabel="Updating status..." tone="secondary" /><StatusForm action={quoteOutcomeAction.bind(null, id, "accepted")} confirmText={`Mark ${number} accepted?`} detail="This records the customer's decision and cannot be reversed in the current workflow." label="Mark accepted" pendingLabel="Updating status..." /></div>;
  return null;
}
