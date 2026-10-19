import type { Address } from "viem";

export type Proposal = {
  description: string;
  createdAt: number;
  deadline: number;
  forVotes: bigint;
  againstVotes: bigint;
};

export function isOpen(p: Proposal, now?: number): boolean {
  return (now ?? Math.floor(Date.now() / 1000)) <= p.deadline;
}

export function totalVotes(p: Proposal): bigint {
  return p.forVotes + p.againstVotes;
}

export function forPercent(p: Proposal): number {
  const t = totalVotes(p);
  return t === 0n ? 50 : Math.round(Number((p.forVotes * 10000n) / t) / 100);
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "closed";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h remaining`;
  if (h > 0) return `${h}h ${m}m remaining`;
  return `${m}m remaining`;
}

export function formatTokenAmount(amount: bigint, decimals: number = 18): string {
  const divisor = 10n ** BigInt(decimals);
  const integerPart = amount / divisor;
  const remainder = amount % divisor;
  const remainderStr = remainder.toString().padStart(decimals, "0").slice(0, 2);
  return `${integerPart.toLocaleString()}.${remainderStr}`;
}
