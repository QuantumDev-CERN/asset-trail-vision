import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { caseById, CASES, SCENARIOS } from "@/data/cases";
import { FlowGraph, GraphLegend } from "@/components/FlowGraph";
import { EvidencePanel, type Selection } from "@/components/EvidencePanel";
import { ConfidencePanel } from "@/components/ConfidencePanel";
import { Chip, DisclosureNote, Panel, PanelHeader, SectionLabel } from "@/components/ui/primitives";
import { bandTone, CHAIN_LABEL, formatDateTime, formatInr, shortAddress } from "@/lib/format";

export const Route = createFileRoute("/cases/$caseId")({
  loader: ({ params }) => {
    const record = caseById(params.caseId);
    if (!record) throw notFound();
    return { record };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Case unavailable — VASP Attribution Engine" }, { name: "robots", content: "noindex" }] };
    }
    const t = `${loaderData.record.id} — ${loaderData.record.title}`;
    return {
      meta: [
        { title: `${t} | VASP Attribution Engine` },
        { name: "description", content: loaderData.record.summary.slice(0, 155) },
        { property: "og:title", content: t },
        { property: "og:description", content: loaderData.record.summary.slice(0, 155) },
      ],
    };
  },
  component: CaseWorkspace,
});

const SEVERITY_TONE = { critical: "destructive", high: "warning", medium: "info", info: "muted" } as const;

function CaseWorkspace() {
  const { record } = Route.useLoaderData();
  const [selection, setSelection] = useState<Selection>({ type: "node", node: record.nodes[0]! });
  const scenario = SCENARIOS.find((s) => s.key === record.scenario);
  const selectedId = selection?.type === "node" ? selection.node.id : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-primary">{record.id}</span>
            <Chip tone="muted" mono>
              {CHAIN_LABEL[record.chain]}
            </Chip>
            <Chip tone={bandTone(record.confidence.band)}>{record.confidence.band}</Chip>
            <Chip tone="muted">{record.status}</Chip>
            {scenario ? <Chip tone={scenario.tier === 1 ? "success" : "warning"}>Tier {scenario.tier}</Chip> : null}
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">{record.title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{record.summary}</p>
        </div>
        <Link
          to="/reports/$caseId"
          params={{ caseId: record.id }}
          className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/85"
        >
          Open investigation report
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Meta label="Suspect address" value={shortAddress(record.suspectAddress, 14, 8)} mono />
        <Meta label="FIR" value={record.firNumber} />
        <Meta label="Investigating officer" value={`${record.officer} · ${record.agency}`} />
        <Meta label="Declared amount" value={formatInr(record.amountInr)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Panel className="overflow-hidden">
          <PanelHeader
            title="Fund-flow graph"
            subtitle={`${record.nodes.length} nodes · ${record.edges.length} classified hops · click any node or hop`}
            right={
              selection ? (
                <button
                  type="button"
                  onClick={() => setSelection(null)}
                  className="text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                >
                  Clear selection
                </button>
              ) : null
            }
          />
          <FlowGraph
            record={record}
            selectedId={selectedId}
            onSelectNode={(node) => setSelection({ type: "node", node })}
            onSelectEdge={(edge) => setSelection({ type: "edge", edge })}
          />
          <div className="border-t border-border px-4 py-3">
            <GraphLegend />
          </div>
        </Panel>

        <Panel as="aside" className="overflow-hidden">
          <PanelHeader title="Evidence" subtitle="Selected node or hop" />
          <EvidencePanel selection={selection} />
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel className="overflow-hidden">
          <PanelHeader title="Confidence attribution" subtitle="Rule-based, explainable, per-signal" />
          <ConfidencePanel record={record} />
        </Panel>

        <div className="space-y-6">
          <Panel>
            <PanelHeader title="Terminus classification" subtitle="Where this trace legally lands" />
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Chip
                  tone={
                    record.terminus.kind === "vasp"
                      ? "success"
                      : record.terminus.kind === "mixer"
                        ? "destructive"
                        : "warning"
                  }
                >
                  {record.terminus.kind === "vasp"
                    ? "Legally-addressable VASP"
                    : record.terminus.kind === "mixer"
                      ? "Mixer boundary"
                      : record.terminus.kind === "otc-hawala"
                        ? "OTC / hawala terminus"
                        : "Unresolved"}
                </Chip>
                <span className="text-sm font-semibold">{record.terminus.label}</span>
              </div>
              <p className="font-mono text-[11.5px] break-all text-muted-foreground">{record.terminus.address}</p>
              <p className="text-xs leading-relaxed text-foreground/85">{record.terminus.statement}</p>
            </div>
          </Panel>

          {record.freezeRecommendation ? (
            <Panel>
              <PanelHeader title="Parallel action available" subtitle="stablecoin_check.py" />
              <div className="p-4">
                <DisclosureNote title="Runs alongside, never instead of, the VASP route">
                  {record.freezeRecommendation}
                </DisclosureNote>
              </div>
            </Panel>
          ) : null}

          <Panel>
            <PanelHeader
              title="Risk flags"
              subtitle={`${record.riskFlags.length} signals from the risk scoring engine`}
            />
            <ul className="divide-y divide-border">
              {record.riskFlags.map((f) => (
                <li key={f.id} className="flex items-start gap-3 px-4 py-3">
                  <Chip tone={SEVERITY_TONE[f.severity]}>{f.severity}</Chip>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold">{f.title}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{f.detail}</p>
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">{f.source}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel>
          <PanelHeader title="Case timeline" subtitle="Every engine action and officer decision, audit-logged" />
          <ol className="space-y-0 p-4">
            {record.timeline.map((t, i) => (
              <li key={t.at + t.title} className="relative flex gap-4 pb-5 last:pb-0">
                {i < record.timeline.length - 1 ? (
                  <span className="absolute top-4 left-[7px] h-full w-px bg-border" aria-hidden="true" />
                ) : null}
                <span className="relative z-10 mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-primary bg-background" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold">{t.title}</p>
                    <Chip tone="muted" mono>
                      {t.phase}
                    </Chip>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{t.detail}</p>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {formatDateTime(t.at)} · {t.actor}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>

        <div className="space-y-6">
          <Panel>
            <PanelHeader title="Cross-case links" subtitle="cross_case.py — persistent knowledge graph" />
            <div className="p-4">
              {record.linkedCases.length ? (
                <ul className="space-y-2">
                  {record.linkedCases.map((id) => {
                    const known = CASES.some((c) => c.id === id);
                    return (
                      <li key={id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-raised px-3 py-2">
                        <span className="font-mono text-xs">{id}</span>
                        {known ? (
                          <Link to="/cases/$caseId" params={{ caseId: id }} className="text-[11px] font-semibold text-primary hover:underline">
                            Open case
                          </Link>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">Archived FIR</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No prior appearances of these addresses in other cases.
                </p>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Scope disclosures for this case" subtitle="Stated in the report, not buried" />
            <ul className="divide-y divide-border">
              {record.scopeNotes.map((n) => (
                <li key={n.note} className="flex items-start gap-3 px-4 py-3">
                  <Chip tone={n.tier === 1 ? "success" : n.tier === 2 ? "warning" : "muted"}>Tier {n.tier}</Chip>
                  <p className="text-[11px] leading-relaxed text-foreground/85">{n.note}</p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="panel px-4 py-3">
      <SectionLabel>{label}</SectionLabel>
      <p className={`mt-1 text-sm break-words ${mono ? "font-mono text-[12.5px]" : ""}`}>{value}</p>
    </div>
  );
}
