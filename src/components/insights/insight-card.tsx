import { AlertCircle, ArrowRight, CircleCheck, Lightbulb } from "lucide-react";
import Link from "next/link";
import type { SmartInsight } from "@/lib/insights/types";

const icon = {
  critical: AlertCircle,
  attention: Lightbulb,
  opportunity: CircleCheck,
};

const severityLabel = {
  critical: "Critical",
  attention: "Attention",
  opportunity: "Opportunity",
};

export function InsightCard({ insight, compact = false }: { insight: SmartInsight; compact?: boolean }) {
  const Icon = icon[insight.severity];
  return (
    <article className={`insight-card insight-${insight.severity}${compact ? " insight-card-compact" : ""}`}>
      <span className="insight-icon" aria-hidden="true"><Icon size={18} /></span>
      <div className="insight-card-copy">
        <p className="insight-severity">{severityLabel[insight.severity]}</p>
        <h2>{insight.title}</h2>
        <p>{insight.explanation}</p>
        <Link href={insight.actionUrl}>{insight.actionLabel}<ArrowRight aria-hidden="true" size={15} /></Link>
      </div>
    </article>
  );
}
