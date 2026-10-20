"use client";

import { useChainId, useReadContract } from "wagmi";
import { isBotChainId } from "@/lib/botchain/chain";
import { getDeployment, isDeployed } from "@/lib/botchain/deployment";
import { assemblyAbi } from "@/lib/botchain/abi";
import ClaimTokens from "./ClaimTokens";

/**
 * The claim panel, standing on its own.
 *
 * ProposalView already knows the token address because it reads it to show tallies; this reads it
 * once so the same component can sit on the proposals index, where someone should be able to get
 * tokens before picking a proposal rather than after discovering they cannot vote on one.
 */
export default function ClaimTokensPanel() {
  const chainId = useChainId();
  const ready = isBotChainId(chainId) && isDeployed(chainId);
  const deployment = ready ? getDeployment(chainId) : null;

  const { data: token } = useReadContract({
    address: deployment?.address,
    abi: assemblyAbi,
    functionName: "token",
    query: { enabled: Boolean(deployment) },
  });

  if (!ready) return null;
  return <ClaimTokens token={token} />;
}
