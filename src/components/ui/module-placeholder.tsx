import { ArrowRight, Database, LockKeyhole } from "lucide-react";

type ModulePlaceholderProps = {
  title: string;
  eyebrow: string;
  description: string;
  action: string;
};

export function ModulePlaceholder({ title, eyebrow, description, action }: ModulePlaceholderProps) {
  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="page-description">{description}</p>
        </div>
        <button className="button button-primary" type="button" disabled>
          <span aria-hidden="true">+</span>
          {action}
        </button>
      </section>

      <section className="module-placeholder" aria-labelledby="module-status-title">
        <div className="module-placeholder-art" aria-hidden="true">
          <div className="art-line art-line-short" />
          <div className="art-line" />
          <div className="art-line" />
          <span><Database size={24} /></span>
        </div>
        <div className="module-placeholder-copy">
          <span className="status-pill">Milestone 1</span>
          <h2 id="module-status-title">Interface ready. Data comes next.</h2>
          <p>
            This route is part of the finished application shell. Its forms,
            lists, filters, and real records will be added after the database
            model and organisation security rules are approved.
          </p>
          <div className="placeholder-notes">
            <span><LockKeyhole size={16} /> Organisation-scoped by design</span>
            <span><ArrowRight size={16} /> Prepared for the next milestone</span>
          </div>
        </div>
      </section>
    </div>
  );
}
