"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BaseError, ContractFunctionRevertedError, formatUnits, type Hex } from "viem";
import {
  useAccount, useChainId, useReadContract, useWaitForTransactionReceipt, useWriteContract,
} from "wagmi";
import Panel from "@/components/ui/Panel";
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

  // No faucet configured for this network: say nothing rather than offer a dead button.
  if (!faucet) return null;

  const decimals = decimalsData ?? 18;
  const symbol = symbolData ?? "GOV";
  const drop = perClaim !== undefined ? formatUnits(perClaim, decimals) : "…";
  const left = remaining !== undefined ? Number(remaining) : null;
  const busy = stage === "signing" || stage === "pending";

  return (
    <Panel title={`Get ${symbol}`}>
      <div className="space-y-3">
        <p className="text-xs text-zinc-400">
          Voting locks {symbol} until a proposal closes, so you need a balance before you can cast
          one. The token is fixed-supply with no mint function — this hands out {drop} {symbol} per
          address from a faucet holding part of that supply.
        </p>

        {alreadyClaimed ? (
          <p className="text-xs text-emerald-400">
            This address has already claimed its {drop} {symbol}.
          </p>
        ) : (
          <>
            <TxStatus stage={stage} hash={hash} />
            <Button onClick={() => void claim()} disabled={busy || !address || left === 0}>
              {busy ? "Claiming…" : left === 0 ? "Faucet is empty" : `Claim ${drop} ${symbol}`}
            </Button>
          </>
        )}

        <p className="text-[11px] text-zinc-500">
          One claim per address.{" "}
          {left !== null && <>About {left.toLocaleString()} claims left. </>}
          <a
            href={addressUrl(chainId, faucet)}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Faucet contract
          </a>
        </p>
      </div>
    </Panel>
  );
}
