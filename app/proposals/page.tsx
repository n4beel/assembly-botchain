"use client";

import PageShell from "@/components/layout/PageShell";
import ProposalList from "@/components/assembly/ProposalList";
import ClaimTokensPanel from "@/components/assembly/ClaimTokensPanel";
import { NAV } from "@/lib/nav";

/**
 * Every proposal, and the one thing that might stop you voting on one.
 *
 * This page used to carry three ways to reach a proposal stacked on top of each other — a list, a
 * lookup by number, and an explainer — plus a claim panel below all of them. The list makes the
 * lookup redundant: there is nothing to type a number for when every proposal is on screen and
 * linked. The explainer repeated the page footer. Both are gone, and the claim moved above the
 * list, because needing tokens is something to discover before choosing a proposal rather than
 * after trying to vote on one.
 */
export default function ProposalsPage() {
  return (
    <PageShell
      nav={NAV}
      title="Proposals"
      description="Every proposal on chain — open now, and those already decided."
    >
      <div className="space-y-5">
        <ClaimTokensPanel />
        <ProposalList />
      </div>
    </PageShell>
  );
}
