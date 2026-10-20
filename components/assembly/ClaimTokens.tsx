"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BaseError, ContractFunctionRevertedError, formatUnits, type Hex } from "viem";
import {
  useAccount, useChainId, useReadContract, useWaitForTransactionReceipt, useWriteContract,
} from "wagmi";
import Button from "@/components/ui/Button";
import TxStatus, { type TxStage } from "@/components/ui/TxStatus";
import { useToast } from "@/components/ui/Toast";
import { addressUrl, isBotChainId } from "@/lib/botchain/chain";
import { getFaucet } from "@/lib/botchain/deployment";
import { erc20Abi, govFaucetAbi } from "@/lib/botchain/abi";

interface ClaimTokensProps {
  token?: `0x${string}`;
  /** Called after a successful claim so the page can re-read the balance. */
  onClaimed?: () => void;
}

/**
 * Get the governance token.
 *
 * Assembly's token is fixed-supply with no mint function — deliberately, that is what the token
 * is — so the whole supply begins in whichever address deployed it. Without a way to obtain some,
 * the only account that can ever vote is that one, and the app cannot be tried by anybody else.
 * This hands out a fixed amount per address from a faucet holding part of the supply.
 */
export default function ClaimTokens({ token, onClaimed }: ClaimTokensProps) {
  const chainId = useChainId();
  const { address } = useAccount();
  const { toast } = useToast();
  const { writeContractAsync } = useWriteContract();

  const faucet = isBotChainId(chainId) ? getFaucet(chainId) : null;

  const [stage, setStage] = useState<TxStage>("idle");
  const [hash, setHash] = useState<Hex | null>(null);

  const { data: alreadyClaimed, refetch: refetchClaimed } = useReadContract({
    address: faucet ?? undefined,
    abi: govFaucetAbi,
    functionName: "claimed",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(faucet && address) },
  });

  const { data: perClaim } = useReadContract({
    address: faucet ?? undefined,
    abi: govFaucetAbi,
    functionName: "amount",
    query: { enabled: Boolean(faucet) },
  });

  const { data: remaining, refetch: refetchRemaining } = useReadContract({
    address: faucet ?? undefined,
    abi: govFaucetAbi,
    functionName: "remainingClaims",
    query: { enabled: Boolean(faucet) },
  });

  const { data: balanceData } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(token && address) },
  });

  const { data: decimalsData } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: Boolean(token) },
  });

  const { data: symbolData } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "symbol",
    query: { enabled: Boolean(token) },
  });

  const receipt = useWaitForTransactionReceipt({
    hash: hash ?? undefined,
    query: { enabled: Boolean(hash) },
  });
  const settled = useRef<Hex | null>(null);

  useEffect(() => {
    if (!hash || settled.current === hash) return;
    if (!receipt.isSuccess && !receipt.isError) return;
    settled.current = hash;
    if (receipt.isSuccess) {
      setStage("confirmed");
      toast("success", "Tokens claimed", "You can now cast a vote.");
      void refetchClaimed();
      void refetchRemaining();
      onClaimed?.();
    } else {
      setStage("failed");
      toast("error", "Claim failed", "Nothing was transferred.");
    }
  }, [hash, receipt.isSuccess, receipt.isError, toast, refetchClaimed, refetchRemaining, onClaimed]);

  const claim = useCallback(async () => {
    if (!faucet) return;
    setStage("signing");
    setHash(null);
    settled.current = null;
    try {
      const txHash = await writeContractAsync({
        address: faucet,
        abi: govFaucetAbi,
        functionName: "claim",
      });
      setHash(txHash);
      setStage("pending");
    } catch (err) {
      setStage("idle");
      const reverted =
        err instanceof BaseError ? err.walk((e) => e instanceof ContractFunctionRevertedError) : null;
      if (reverted instanceof ContractFunctionRevertedError) {
        const name = reverted.data?.errorName;
        if (name === "AlreadyClaimed") {
          toast("info", "Already claimed", "This address has had its share.");
          void refetchClaimed();
          return;
        }
        if (name === "FaucetEmpty") {
          toast("error", "Faucet is empty", "No tokens left to hand out.");
          return;
        }
        toast("error", "Could not claim", name ?? "The contract did not say why.");
        return;
      }
      const message = err instanceof BaseError ? err.shortMessage : "Something went wrong.";
      if (/rejected|denied/i.test(message)) toast("info", "Cancelled", "Nothing was sent.");
      else toast("error", "Could not claim", message);
    }
  }, [faucet, writeContractAsync, toast, refetchClaimed]);

  const decimals = decimalsData ?? 18;
  const symbol = symbolData ?? "GOV";
  const drop = perClaim !== undefined ? formatUnits(perClaim, decimals) : "…";
  const left = remaining !== undefined ? Number(remaining) : null;
  const busy = stage === "signing" || stage === "pending";
  const balance = balanceData ?? 0n;

  // Shown only when it is the thing standing between you and a vote. No faucet on this network,
  // no wallet, or a balance already in hand — in each case this is noise, so it renders nothing.
  // It used to be a full panel sitting below the proposals whether or not it was any use.
  if (!faucet || !address) return null;
  if (balance > 0n) return null;
  if (alreadyClaimed) {
    return (
      <p className="text-xs text-zinc-500">
        This address claimed its {drop} {symbol} already — the balance is committed to an open
        proposal and returns when that proposal closes.
      </p>
    );
  }

  return (
    <div
      className="rounded-lg border border-indigo-900/60 bg-indigo-950/20 p-3 flex flex-wrap items-center gap-3"
    >
      <div className="flex-1 min-w-[16rem]">
        <p className="text-sm text-zinc-200">You need {symbol} to vote.</p>
        <p className="text-xs text-zinc-400 mt-0.5">
          Voting locks it until the proposal closes. {drop} {symbol} per address, once —{" "}
          {left !== null && <>{left.toLocaleString()} left, </>}
          <a href={addressUrl(chainId, faucet)} target="_blank" rel="noreferrer" className="underline">
            from this faucet
          </a>
          .
        </p>
      </div>

      <Button onClick={() => void claim()} disabled={busy || left === 0}>
        {busy ? "Claiming…" : left === 0 ? "Faucet is empty" : `Claim ${drop} ${symbol}`}
      </Button>

      {(stage === "pending" || stage === "failed") && (
        <div className="w-full">
          <TxStatus stage={stage} hash={hash} />
        </div>
      )}
    </div>
  );
}
