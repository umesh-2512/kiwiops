import type { Metadata } from "next";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { InsightCard } from "@/components/insights/insight-card";
import { getSmartInsightFacts, requireInsightsOfficeContext } from "@/lib/insights/data";
import { smartInsightPageState } from "@/lib/insights/presentation";

export const metadata: Metadata = { title: "Smart Insights" };

export default async function InsightsPage() {
  const { organization } = await requireInsightsOfficeContext();
  let state;
  try {
    state = smartInsightPageState(await getSmartInsightFacts(organization.id));
  } catch {
    state = smartInsightPageState(null, true);
  }

  if (state.kind === "error") {
    return <section className="route-error" role="alert"><span className="empty-mark"><AlertCircle aria-hidden="true" size={20} /></span><p className="eyebrow">Insights unavailable</p><h1>We couldn&apos;t load Smart Insights.</h1><p>No operational issues have been replaced with an all-clear message. Refresh after checking the database connection.</p></section>;
  }

  return (
    <div className="page-stack insights-page">
      <section className="page-heading insights-heading">
        <div><p className="eyebrow">Operational assistant</p><h1>Smart Insights</h1><p className="page-description">Important things across your business that may need attention.</p></div>
        <div className="insights-summary" aria-label="Insight summary"><strong>{state.kind === "active" ? state.insights.length : 0}</strong><span>{state.kind === "active" ? `${state.insights.length === 1 ? "thing needs" : "things need"} your attention` : "active issues"}</span></div>
      </section>

      {state.kind === "clear" ? (
        <section className="insights-clear"><span><CheckCircle2 aria-hidden="true" size={24} /></span><div><p className="eyebrow">No active insights</p><h2>You&apos;re all caught up.</h2><p>No urgent operational issues need your attention right now.</p></div></section>
      ) : (
        <section className="insights-grid" aria-label="Active Smart Insights">{state.insights.map((insight) => <InsightCard insight={insight} key={insight.key} />)}</section>
      )}
    </div>
  );
}
