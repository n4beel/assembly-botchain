"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BaseError,
  ContractFunctionRevertedError,
  parseEventLogs,
  type Hex,
} from "viem";
import { useAccount, useChainId, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import BotChainGate from "@/components/botchain/BotChainGate";
import Panel from "@/components/ui/Panel";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import TxStatus, { type TxStage } from "@/components/ui/TxStatus";
import { useToast } from "@/components/ui/Toast";
import { isBotChainId } from "@/lib/botchain/chain";
import { getDeployment } from "@/lib/botchain/deployment";
import { assemblyAbi } from "@/lib/botchain/abi";
import { MIN_DURATION, MAX_DURATION } from "@/lib/assembly";

// The contract's own bounds, in the unit it is given. MIN_DURATION = 1 hours, MAX_DURATION = 30

/**
 * The windows a proposal is actually given, spanning the contract's full range.
 *
 * MIN_DURATION is one hour and MAX_DURATION thirty days; both ends are offered so neither is
 * reachable only by arithmetic.
 */
const DURATIONS = [
  { label: "1 hour", seconds: 3600 },
  { label: "6 hours", seconds: 6 * 3600 },
  { label: "24 hours", seconds: 86400 },
  { label: "3 days", seconds: 3 * 86400 },
  { label: "7 days", seconds: 7 * 86400 },
  { label: "14 days", seconds: 14 * 86400 },
  { label: "30 days", seconds: 30 * 86400 },
] as const;

export default function ProposeForm() {
  return (
    <BotChainGate
      noWalletNote="Creating a proposal requires connecting a native BOT Chain wallet."
    >
      <ProposeFormInner />
    </BotChainGate>
  );
}

function ProposeFormInner() {
  const chainId = useChainId();
  const { address } = useAccount();
  const { toast } = useToast();
  const { writeContractAsync } = useWriteContract();

  const [description, setDescription] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(7 * 86400);

  const [stage, setStage] = useState<TxStage>("idle");
  const [hash, setHash] = useState<Hex | null>(null);
  const [createdId, setCreatedId] = useState<bigint | null>(null);

  const deployment = isBotChainId(chainId) ? getDeployment(chainId) : null;

  const receipt = useWaitForTransactionReceipt({
    hash: hash ?? undefined,
    query: { enabled: Boolean(hash) },
  });

  const settledHash = useRef<Hex | null>(null);

  useEffect(() => {
    if (!hash || settledHash.current === hash) return;
    if (!receipt.isSuccess && !receipt.isError) return;

    settledHash.current = hash;

    if (receipt.isSuccess) {
      setStage("confirmed");
      toast("success", "Proposal created", "Your proposal is now open for voting.");

      if (receipt.data?.logs) {
        try {
          const logs = parseEventLogs({
            abi: assemblyAbi,
            eventName: "ProposalCreated",
            logs: receipt.data.logs,
          });
          if (logs.length > 0 && logs[0].args?.id !== undefined) {
            setCreatedId(logs[0].args.id);
          }
        } catch {
          // fallback
        }
      }
    } else {
      setStage("failed");
      toast(
        "error",
        "Transaction failed",
        "The proposal could not be created. Check the explorer and try again."
      );
    }
  }, [hash, receipt.isSuccess, receipt.isError, receipt.data, toast]);

  const trimmedDesc = description.trim();
  // Checked on the seconds that are sent, not the days that were typed. The two agree across the
  // whole current input range, but only by arithmetic accident: the UI bound (1/24 days) and the
  // contract bound (3600 seconds) are separate numbers, and flooring sits between them.
  const durationSecondsNum = durationSeconds;
  // Shown rather than left to be worked out: a deadline is the thing a voter plans around.
  const closesAt = new Date(Date.now() + durationSeconds * 1000);
  const durationValid =
    Number.isFinite(durationSecondsNum) &&
    durationSecondsNum >= MIN_DURATION &&
    durationSecondsNum <= MAX_DURATION;

  const handleSubmit = useCallback(async () => {
    if (!trimmedDesc || !durationValid || !deployment || !isBotChainId(chainId)) return;

    const durationSeconds = BigInt(durationSecondsNum);

    setStage("signing");
    try {
      const txHash = await writeContractAsync({
        address: deployment.address,
        abi: assemblyAbi,
        functionName: "propose",
        args: [trimmedDesc, durationSeconds],
      });
      setHash(txHash);
      setStage("pending");
      toast("info", "Transaction submitted", "Waiting for block confirmation...");
    } catch (err) {
      setStage("failed");
      if (err instanceof BaseError) {
        const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
        if (revert instanceof ContractFunctionRevertedError) {
          toast("error", "Proposal rejected", revert.data?.errorName ?? revert.message);
          return;
        }
      }
      toast("error", "Submission cancelled", err instanceof Error ? err.message : "Unknown error");
    }
  }, [trimmedDesc, durationValid, durationSecondsNum, deployment, chainId, writeContractAsync, toast]);

  if (stage === "confirmed") {
    return (
      <Panel title="Proposal Created">
        <div className="space-y-4">
          <p className="text-sm text-zinc-300">
            Your proposal has been recorded on BOT Chain. Voters can now lock tokens to vote for or against it.
          </p>
          {createdId !== null && (
            <div className="p-4 bg-zinc-900/60 rounded border border-zinc-800">
              <span className="text-xs text-zinc-500 block mb-1">Proposal #{createdId.toString()}</span>
              <p className="text-sm font-medium text-white mb-3">{trimmedDesc}</p>
              <Link href={`/proposal/${createdId.toString()}`}>
                <Button>View Proposal & Vote →</Button>
              </Link>
            </div>
          )}
          <TxStatus stage={stage} hash={hash} />
          <Button
            variant="ghost"
            onClick={() => {
              setDescription("");
              setDurationSeconds(7 * 86400);
              setStage("idle");
              setHash(null);
              setCreatedId(null);
              settledHash.current = null;
            }}
          >
            Create Another Proposal
          </Button>
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="New Proposal">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            Description
          </label>
          <textarea
            className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
            rows={4}
            placeholder="Describe what the community is voting on..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            Voting duration
          </label>

          {/* Chosen from the windows people actually want, not typed as a fraction of a day. The
              field used to ask for days with step 0.1, which made the contract's one-hour minimum
              reachable only by entering 0.0417 — a number nobody arrives at. */}
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((d) => {
              const active = durationSeconds === d.seconds;
              return (
                <button
                  key={d.label}
                  type="button"
                  onClick={() => setDurationSeconds(d.seconds)}
                  disabled={stage === "signing" || stage === "pending"}
                  className={[
                    "px-3 py-1.5 text-xs rounded border transition-colors cursor-pointer",
                    active
                      ? "border-indigo-500 bg-indigo-950/40 text-indigo-200"
                      : "border-zinc-800 text-zinc-400 hover:border-zinc-700",
                  ].join(" ")}
                >
                  {d.label}
                </button>
              );
            })}
          </div>

          <p className="mt-2 text-xs text-zinc-500">
            Voting closes {closesAt.toLocaleString()} — {DURATIONS.find((d) => d.seconds === durationSeconds)?.label} from
            the moment the proposal is created. The contract accepts one hour to thirty days.
          </p>
        </div>

        <div className="p-3 bg-zinc-900/50 rounded border border-zinc-800 text-xs text-zinc-400 space-y-1">
          <p className="font-semibold text-zinc-300">Vote-locking mechanism:</p>
          <p>• Voters deposit tokens to cast their vote and withdraw them after the deadline.</p>
          <p>• Advisory vote: results are community consensus; on-chain execution is off-chain.</p>
        </div>

        <TxStatus stage={stage} hash={hash} />

        <Button
          onClick={handleSubmit}
          disabled={!trimmedDesc || !durationValid || stage === "signing" || stage === "pending"}
        >
          {stage === "signing" ? "Confirming in Wallet..." : stage === "pending" ? "Creating Proposal..." : "Submit Proposal"}
        </Button>
      </div>
    </Panel>
  );
}
