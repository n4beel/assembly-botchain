export const assemblyAbi = [
  {
    type: "function",
    name: "propose",
    stateMutability: "nonpayable",
    inputs: [
      { name: "description", type: "string" },
      { name: "duration", type: "uint64" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "castVote",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "support", type: "bool" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "withdrawTokens",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "proposalOf",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "description", type: "string" },
          { name: "createdAt", type: "uint64" },
          { name: "deadline", type: "uint64" },
          { name: "forVotes", type: "uint256" },
          { name: "againstVotes", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "token",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "hasVoted",
    stateMutability: "view",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "voter", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "depositedBy",
    stateMutability: "view",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "voter", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "MIN_DURATION",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    type: "function",
    name: "MAX_DURATION",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    type: "event",
    name: "ProposalCreated",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "proposer", type: "address", indexed: true },
      { name: "description", type: "string", indexed: false },
      { name: "deadline", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "VoteCast",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "voter", type: "address", indexed: true },
      { name: "support", type: "bool", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TokensWithdrawn",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "voter", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "error",
    name: "ZeroToken",
    inputs: [],
  },
  {
    type: "error",
    name: "DurationTooShort",
    inputs: [
      { name: "duration", type: "uint64" },
      { name: "min", type: "uint64" },
    ],
  },
  {
    type: "error",
    name: "DurationTooLong",
    inputs: [
      { name: "duration", type: "uint64" },
      { name: "max", type: "uint64" },
    ],
  },
  {
    type: "error",
    name: "NotFound",
    inputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "error",
    name: "ProposalClosed",
    inputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "error",
    name: "ProposalStillOpen",
    inputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "error",
    name: "AlreadyVoted",
    inputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "error",
    name: "ZeroDeposit",
    inputs: [],
  },
  {
    type: "error",
    name: "NothingToWithdraw",
    inputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "error",
    name: "TransferFailed",
    inputs: [{ name: "id", type: "uint256" }],
  },
] as const;

export const erc20Abi = [
  // The token's own errors, so a revert that comes from transferFrom reads as a sentence rather
  // than an undecoded selector. castVote reverting InsufficientBalance is the common case — the
  // voter approved, which an allowance larger than a balance permits, and then had nothing to
  // transfer. These two are ForgedToken's; see forge-botchain/contracts/src/ForgedToken.sol.
  {
    type: "error",
    name: "InsufficientBalance",
    inputs: [
      { name: "balance", type: "uint256" },
      { name: "needed", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "InsufficientAllowance",
    inputs: [
      { name: "allowed", type: "uint256" },
      { name: "needed", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

export const contractAbi = assemblyAbi;

/**
 * The governance-token faucet.
 *
 * Assembly's token is fixed-supply with no mint, so the entire supply starts in one address and
 * nobody else can vote. The faucet holds a share of it and hands out a fixed amount per address,
 * which is the only thing that makes the app usable by anyone who did not deploy it.
 */
export const govFaucetAbi = [
  { type: "function", name: "claim", stateMutability: "nonpayable", inputs: [], outputs: [] },
  {
    type: "function",
    name: "claimed",
    stateMutability: "view",
    inputs: [{ name: "claimer", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "amount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "remainingClaims",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "Claimed",
    inputs: [
      { name: "who", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  { type: "error", name: "AlreadyClaimed", inputs: [{ name: "who", type: "address" }] },
  {
    type: "error",
    name: "FaucetEmpty",
    inputs: [
      { name: "held", type: "uint256" },
      { name: "needed", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "TransferFailed",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
  },
] as const;
