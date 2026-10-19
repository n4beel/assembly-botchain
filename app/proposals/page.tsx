"use client";

import { useState } from "react";
import Link from "next/link";
import PageShell from "@/components/layout/PageShell";
import Panel from "@/components/ui/Panel";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { NAV } from "@/lib/nav";

export default function ProposalsPage() {
  const [lookupId, setLookupId] = useState("");

  return (
    <PageShell
      nav={NAV}
      title="Proposals"
      description="Look up and vote on community governance proposals."
    >
      <div className="space-y-6">
        <Panel title="Find a Proposal">
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">
              Enter a proposal ID to view current tallies, cast your vote with locked tokens, or withdraw your tokens after the deadline.
            </p>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Proposal ID (e.g. 1)"
                value={lookupId}
                onChange={(e) => setLookupId(e.target.value)}
              />
              <Link href={lookupId.trim() ? `/proposal/${lookupId.trim()}` : "#"}>
                <Button disabled={!lookupId.trim()}>View →</Button>
              </Link>
            </div>
          </div>
        </Panel>

        <Panel title="About Voting">
          <div className="space-y-3 text-xs text-zinc-400">
            <p>
              <strong className="text-zinc-200">Vote-Locking:</strong> Assembly does not rely on snapshot checkpoints. Instead, voters deposit and lock their governance tokens for the duration of the proposal. Once the deadline passes, tokens are safely withdrawn by their depositors.
            </p>
            <p>
              <strong className="text-zinc-200">Advisory Consensus:</strong> Results represent token-weighted advisory voting. Any resulting on-chain operations are enacted by community maintainers.
            </p>
          </div>
        </Panel>
      </div>
    </PageShell>
  );
}
