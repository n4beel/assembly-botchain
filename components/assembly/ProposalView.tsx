"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BaseError,
  ContractFunctionRevertedError,
  formatUnits,
  parseUnits,
  type Hex,
} from "viem";
import {
  useAccount,
  useChainId,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import BotChainGate from "@/components/botchain/BotChainGate";
import Panel from "@/components/ui/Panel";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import TxStatus, { type TxStage } from "@/components/ui/TxStatus";
import { useToast } from "@/components/ui/Toast";
import { isBotChainId } from "@/lib/botchain/chain";
import { getDeployment } from "@/lib/botchain/deployment";
import { assemblyAbi, erc20Abi } from "@/lib/botchain/abi";
import {
  forPercent,
  formatDuration,
  formatTokenAmount,
  isOpen,
  totalVotes,
  type Proposal,
} from "@/lib/assembly";

interface ProposalViewProps {
  id: bigint;
}

export default function ProposalView({ id }: ProposalViewProps) {
  const chainId = useChainId();
  const { address } = useAccount();
  const { toast } = useToast();
  const { writeContractAsync } = useWriteContract();

  const deployment = isBotChainId(chainId) ? getDeployment(chainId) : null;

  const {
    data: proposalData,
    isLoading: isProposalLoading,
    error: proposalError,
    refetch: refetchProposal,
  } = useReadContract({
    address: deployment?.address,
    abi: assemblyAbi,
    functionName: "proposalOf",
    args: [id],
    query: { enabled: Boolean(deployment) },
  });

  const { data: tokenAddress } = useReadContract({
    address: deployment?.address,
    abi: assemblyAbi,
    functionName: "token",
    query: { enabled: Boolean(deployment) },
  });

  const { data: hasVotedData, refetch: refetchHasVoted } = useReadContract({
    address: deployment?.address,
    abi: assemblyAbi,
    functionName: "hasVoted",
    args: [id, address!],
    query: { enabled: Boolean(deployment && address) },
  });

  const { data: depositedAmountData, refetch: refetchDeposited } = useReadContract({
    address: deployment?.address,
    abi: assemblyAbi,
    functionName: "depositedBy",
    args: [id, address!],
    query: { enabled: Boolean(deployment && address) },
  });

  const { data: tokenDecimalsData } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: Boolean(tokenAddress) },
  });

  const { data: tokenSymbolData } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "symbol",
    query: { enabled: Boolean(tokenAddress) },
  });

  const { data: tokenBalanceData, refetch: refetchBalance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address!],
    query: { enabled: Boolean(tokenAddress && address) },
  });

  const { data: allowanceData, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address!, deployment?.address!],
    query: { enabled: Boolean(tokenAddress && deployment && address) },
  });

  const decimals = tokenDecimalsData ?? 18;
  const symbol = tokenSymbolData ?? "GOV";

  const [voteAmount, setVoteAmount] = useState("10");
  const [supportChoice, setSupportChoice] = useState<boolean>(true);
  const [actionType, setActionType] = useState<"approve" | "vote" | "withdraw">("vote");
  const [stage, setStage] = useState<TxStage>("idle");
  const [hash, setHash] = useState<Hex | null>(null);

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
      if (actionType === "approve") {
        toast("success", "Approved", "Tokens approved. You can now cast your vote.");
        void refetchAllowance();
      } else if (actionType === "vote") {
        toast("success", "Vote cast", "Your tokens are locked in the vote until deadline.");
        void refetchProposal();
        void refetchHasVoted();
        void refetchDeposited();
        void refetchBalance();
      } else {
        toast("success", "Tokens withdrawn", "Your locked tokens have been returned to your wallet.");
        void refetchDeposited();
        void refetchBalance();
      }
    } else {
      setStage("failed");
      toast("error", "Transaction failed", "Transaction reverted. Check the explorer and try again.");
    }
  }, [
    hash,
    receipt.isSuccess,
    receipt.isError,
    actionType,
    refetchAllowance,
    refetchProposal,
    refetchHasVoted,
    refetchDeposited,
    refetchBalance,
    toast,
  ]);

  if (isProposalLoading) {
    return (
      <Panel title={`Proposal #${id.toString()}`}>
        <p className="text-sm text-zinc-500 animate-pulse">Loading proposal from chain...</p>
      </Panel>
    );
  }

  if (proposalError || !proposalData || Number(proposalData.createdAt) === 0) {
    return (
      <Panel title={`Proposal #${id.toString()}`}>
        <div className="space-y-3">
          <p className="text-sm text-zinc-400">Proposal not found on chain.</p>
          <Link href="/proposals">
            <Button variant="ghost">← Back to Proposals</Button>
          </Link>
        </div>
      </Panel>
    );
  }

  const proposal: Proposal = {
    description: proposalData.description,
    createdAt: Number(proposalData.createdAt),
    deadline: Number(proposalData.deadline),
    forVotes: proposalData.forVotes,
    againstVotes: proposalData.againstVotes,
  };

  const open = isOpen(proposal);
  const nowSec = Math.floor(Date.now() / 1000);
  const timeRemaining = proposal.deadline - nowSec;
  const pctFor = forPercent(proposal);
  const total = totalVotes(proposal);

  const parsedAmount = (() => {
    try {
      return parseUnits(voteAmount.trim() || "0", decimals);
    } catch {
      return 0n;
    }
  })();

  const allowance = allowanceData ?? 0n;
  const needsApproval = parsedAmount > 0n && allowance < parsedAmount;
  const hasVoted = Boolean(hasVotedData);
  const deposited = depositedAmountData ?? 0n;

  const handleApprove = async () => {
    if (!tokenAddress || !deployment || parsedAmount <= 0n) return;
    setActionType("approve");
    setStage("signing");
    try {
      const txHash = await writeContractAsync({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [deployment.address, parsedAmount * 10n],
      });
      setHash(txHash);
      setStage("pending");
      toast("info", "Approval submitted", "Confirming token approval...");
    } catch (err) {
      setStage("failed");
      toast("error", "Approval failed", err instanceof Error ? err.message : "Reverted");
    }
  };

  const handleVote = async (support: boolean) => {
    if (!deployment || parsedAmount <= 0n) return;
    setSupportChoice(support);
    setActionType("vote");
    setStage("signing");
    try {
      const txHash = await writeContractAsync({
        address: deployment.address,
        abi: assemblyAbi,
        functionName: "castVote",
        args: [id, support, parsedAmount],
      });
      setHash(txHash);
      setStage("pending");
      toast("info", "Vote submitted", "Recording vote on chain...");
    } catch (err) {
      setStage("failed");
      if (err instanceof BaseError) {
        const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
        if (revert instanceof ContractFunctionRevertedError) {
          toast("error", "Vote rejected", revert.data?.errorName ?? revert.message);
          return;
        }
      }
      toast("error", "Vote cancelled", err instanceof Error ? err.message : "Reverted");
    }
  };

  const handleWithdraw = async () => {
    if (!deployment || deposited <= 0n) return;
    setActionType("withdraw");
    setStage("signing");
    try {
      const txHash = await writeContractAsync({
        address: deployment.address,
        abi: assemblyAbi,
        functionName: "withdrawTokens",
        args: [id],
      });
      setHash(txHash);
      setStage("pending");
      toast("info", "Withdrawal submitted", "Returning tokens to wallet...");
    } catch (err) {
      setStage("failed");
      toast("error", "Withdrawal failed", err instanceof Error ? err.message : "Reverted");
    }
  };

  return (
    <div className="space-y-6">
      <Panel>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-white">Proposal #{id.toString()}</h2>
          <Badge variant={open ? "confirmed" : "default"}>{open ? "Voting Open" : "Closed"}</Badge>
        </div>
        <div className="space-y-4">
          <p className="text-base font-medium text-white whitespace-pre-wrap">{proposal.description}</p>

          <div className="flex flex-wrap gap-4 text-xs text-zinc-400 border-t border-b border-zinc-800 py-3">
            <div>
              <span className="text-zinc-500 block">Created</span>
              <span>{new Date(proposal.createdAt * 1000).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-zinc-500 block">Deadline</span>
              <span>{new Date(proposal.deadline * 1000).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-zinc-500 block">Status</span>
              <span>{open ? formatDuration(timeRemaining) : "Voting Ended"}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-emerald-400 font-medium">For: {pctFor}% ({formatUnits(proposal.forVotes, decimals)} {symbol})</span>
              <span className="text-rose-400 font-medium">Against: {100 - pctFor}% ({formatUnits(proposal.againstVotes, decimals)} {symbol})</span>
            </div>
            <div className="w-full bg-rose-950/40 rounded-full h-3 overflow-hidden border border-zinc-800 flex">
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${pctFor}%` }}
              />
              <div
                className="bg-rose-500 h-full transition-all duration-300"
                style={{ width: `${100 - pctFor}%` }}
              />
            </div>
            <p className="text-xs text-zinc-500 text-right">
              Total locked votes: {formatUnits(total, decimals)} {symbol}
            </p>
          </div>
        </div>
      </Panel>

      <BotChainGate noWalletNote="Connect a wallet holding the governance token to vote or withdraw.">
        <Panel title="Participate">
          <div className="space-y-4">
            {stage === "confirmed" && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded text-xs text-emerald-300">
                Action confirmed!
              </div>
            )}

            {open ? (
              hasVoted ? (
                <div className="p-3 bg-zinc-900 rounded border border-zinc-800 text-xs text-zinc-300 space-y-1">
                  <p className="font-semibold text-white">You have already voted on this proposal.</p>
                  <p>Locked deposit: {formatUnits(deposited, decimals)} {symbol}</p>
                  <p className="text-zinc-500">You can withdraw your tokens after the deadline passes.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                        Tokens to lock ({symbol})
                      </label>
                      {tokenBalanceData !== undefined && (
                        <span className="text-xs text-zinc-500">
                          Balance: {formatUnits(tokenBalanceData, decimals)} {symbol}
                        </span>
                      )}
                    </div>
                    <Input
                      type="text"
                      placeholder="0.0"
                      value={voteAmount}
                      onChange={(e) => setVoteAmount(e.target.value)}
                    />
                  </div>

                  <TxStatus stage={stage} hash={hash} />

                  {needsApproval ? (
                    <div className="space-y-2">
                      <p className="text-xs text-amber-400">
                        Step 1 of 2: Approve Assembly to lock your {symbol} tokens for voting.
                      </p>
                      <Button
                        onClick={handleApprove}
                        disabled={stage === "signing" || stage === "pending"}
                      >
                        {stage === "signing" ? "Approving in Wallet..." : "Step 1: Approve Tokens"}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <Button
                        onClick={() => handleVote(true)}
                        disabled={parsedAmount <= 0n || stage === "signing" || stage === "pending"}
                        className="bg-emerald-600 hover:bg-emerald-500 flex-1"
                      >
                        Vote For ({voteAmount} {symbol})
                      </Button>
                      <Button
                        onClick={() => handleVote(false)}
                        disabled={parsedAmount <= 0n || stage === "signing" || stage === "pending"}
                        variant="ghost"
                        className="border-rose-600 text-rose-400 hover:bg-rose-950/30 flex-1"
                      >
                        Vote Against ({voteAmount} {symbol})
                      </Button>
                    </div>
                  )}
                </div>
              )
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-zinc-400">Voting for this proposal has closed.</p>
                {deposited > 0n ? (
                  <div className="p-3 bg-zinc-900 rounded border border-zinc-800 space-y-3">
                    <p className="text-xs text-zinc-300">
                      You have {formatUnits(deposited, decimals)} {symbol} locked from your vote.
                    </p>
                    <TxStatus stage={stage} hash={hash} />
                    <Button
                      onClick={handleWithdraw}
                      disabled={stage === "signing" || stage === "pending"}
                    >
                      Withdraw {formatUnits(deposited, decimals)} {symbol}
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500">No tokens locked for withdrawal.</p>
                )}
              </div>
            )}
          </div>
        </Panel>
      </BotChainGate>
    </div>
  );
}
