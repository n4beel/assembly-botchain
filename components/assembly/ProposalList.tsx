"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { formatUnits } from "viem";
import { useChainId, usePublicClient, useReadContract, useReadContracts } from "wagmi";
import Panel from "@/components/ui/Panel";
import Spinner from "@/components/ui/Spinner";
import Badge from "@/components/ui/Badge";
import { isBotChainId } from "@/lib/botchain/chain";
import { getDeployment, isDeployed } from "@/lib/botchain/deployment";
import { assemblyAbi, erc20Abi } from "@/lib/botchain/abi";

/**
 * Every proposal, open ones first.
 *
 * A governance app whose only route to a proposal is typing its number is not one a visitor can
 * browse, and browsing is most of what a visitor does — the point of a public vote is that the
 * public can see it. The contract keeps no array of proposals, but `ProposalCreated` carries the
 * id, so one log query is the whole index. No wallet needed: this reads.
 */
type CreatedEvent = Extract<(typeof assemblyAbi)[number], { type: "event"; name: "ProposalCreated" }>;

/** Taken from the ABI itself; re-typing the signature here is how the two drift apart. */
const CREATED = assemblyAbi.find(
  (item): item is CreatedEvent => item.type === "event" && item.name === "ProposalCreated",
)!;

interface Proposal {
  description: string;
  createdAt: bigint;
  deadline: bigint;
  forVotes: bigint;
  againstVotes: bigint;
}

export default function ProposalList() {
  const chainId = useChainId();
  const publicClient = usePublicClient(); // stable-hook-result

  const [ids, setIds] = useState<bigint[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [now, setNow] = useState(() => BigInt(Math.floor(Date.now() / 1000)));

  useEffect(() => {
    const t = setInterval(() => setNow(BigInt(Math.floor(Date.now() / 1000))), 10_000);
    return () => clearInterval(t);
  }, []);

  const ready = isBotChainId(chainId) && isDeployed(chainId);
  const deployment = ready ? getDeployment(chainId) : null;
  const contract = deployment?.address;
  const fromBlock = deployment?.deployBlock;

  const scanned = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || !publicClient || !contract || fromBlock === undefined) return;
    const key = String(chainId);
    if (scanned.current === key) return;
    scanned.current = key;

    let cancelled = false;
    void (async () => {
      try {
        const logs = await publicClient.getLogs({ address: contract, event: CREATED, fromBlock });
        if (cancelled) return;
        const found: bigint[] = [];
        const seen = new Set<string>();
        for (const log of logs) {
          const { id } = log.args;
          if (id === undefined || seen.has(id.toString())) continue;
          seen.add(id.toString());
          found.push(id);
        }
        found.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)); // newest first
        setIds(found);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, publicClient, contract, fromBlock, chainId]);

  const details = useReadContracts({
    contracts: (ids ?? []).map((id) => ({
      address: contract,
      abi: assemblyAbi,
      functionName: "proposalOf" as const,
      args: [id] as const,
    })),
    query: { enabled: Boolean(ids?.length) && Boolean(contract) },
  });

  const { data: tokenAddress } = useReadContract({
    address: contract,
    abi: assemblyAbi,
    functionName: "token",
    query: { enabled: Boolean(contract) },
  });

  const { data: decimalsData } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: Boolean(tokenAddress) },
  });

  const { data: symbolData } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "symbol",
    query: { enabled: Boolean(tokenAddress) },
  });

  const decimals = decimalsData ?? 18;
  const symbol = symbolData ?? "GOV";

  const rows = useMemo(() => {
    if (!ids) return [];
    return ids.map((id, i) => ({
      id,
      p: details.data?.[i]?.result as Proposal | undefined,
    }));
  }, [ids, details.data]);

  const open = rows.filter((r) => r.p && r.p.deadline > now);
  const closed = rows.filter((r) => r.p && r.p.deadline <= now);

  if (!ready) return null;

  if (failed) {
    return (
      <Panel title="Proposals">
        <p className="text-xs text-zinc-400">
          Could not list proposals — the node refused the log query. They are still reachable by
          number below.
        </p>
      </Panel>
    );
  }

  if (ids === null) {
    return (
      <Panel title="Proposals">
        <Spinner label="Reading proposals from the chain" />
      </Panel>
    );
  }

  if (ids.length === 0) {
    return (
      <Panel title="Proposals">
        <p className="text-xs text-zinc-400">No proposals yet. Create the first one.</p>
      </Panel>
    );
  }

  const row = (id: bigint, p: Proposal | undefined, isOpen: boolean) => {
    const forV = p ? Number(formatUnits(p.forVotes, decimals)) : 0;
    const againstV = p ? Number(formatUnits(p.againstVotes, decimals)) : 0;
    const total = forV + againstV;
    const pct = total > 0 ? Math.round((forV / total) * 100) : 0;
    return (
      <li key={id.toString()} className="py-3 border-b border-zinc-800 last:border-0">
        <div className="flex items-baseline gap-3 flex-wrap">
          <Link href={`/proposal/${id.toString()}`} className="font-mono text-sm text-indigo-400 underline">
            #{id.toString()}
          </Link>
          <span className="text-sm text-zinc-200 flex-1 min-w-0 truncate">
            {p?.description ?? "…"}
          </span>
          <Badge variant={isOpen ? "pending" : "default"}>{isOpen ? "Open" : "Closed"}</Badge>
        </div>

        {p && (
          <div className="mt-2 flex items-center gap-3 text-[11px] text-zinc-500">
            <span className="text-emerald-400">{forV} for</span>
            <span className="text-rose-400">{againstV} against</span>
            <span>{symbol}</span>
            {total > 0 && (
              <span className="flex-1 h-1 rounded bg-rose-900/60 overflow-hidden max-w-[160px]">
                <span className="block h-full bg-emerald-500" style={{ width: `${pct}%` }} />
              </span>
            )}
            <span className="ml-auto">
              {isOpen ? "closes " : "closed "}
              {new Date(Number(p.deadline) * 1000).toLocaleString()}
            </span>
          </div>
        )}
      </li>
    );
  };

  return (
    <Panel title={`Open proposals (${open.length})`}>
      <div className="space-y-3">
        {open.length === 0 ? (
          <p className="text-xs text-zinc-400">Nothing open right now.</p>
        ) : (
          <ul className="list-none p-0 m-0">{open.map((r) => row(r.id, r.p, true))}</ul>
        )}

        {closed.length > 0 && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowClosed((v) => !v)}
              className="text-xs text-zinc-400 underline cursor-pointer"
            >
              {showClosed ? "Hide" : "Show"} {closed.length} past proposal
              {closed.length === 1 ? "" : "s"}
            </button>
            {showClosed && <ul className="list-none p-0 m-0 mt-2">{closed.map((r) => row(r.id, r.p, false))}</ul>}
          </div>
        )}
      </div>
    </Panel>
  );
}
