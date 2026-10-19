import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createPublicClient, createWalletClient, defineChain, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const PORT = 8547;
const RPC = `http://127.0.0.1:${PORT}`;
const CHAIN_ID = 968;
const KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const local = defineChain({
  id: CHAIN_ID,
  name: "anvil",
  nativeCurrency: { name: "Test BOT", symbol: "tBOT", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

spawn("anvil", ["--port", String(PORT), "--chain-id", String(CHAIN_ID), "--silent"], {
  detached: true,
  stdio: "ignore",
}).unref();

const account = privateKeyToAccount(KEY);
const pub = createPublicClient({ chain: local, transport: http() });
const wallet = createWalletClient({ account, chain: local, transport: http() });

for (let i = 0; ; i++) {
  try {
    await pub.getBlockNumber();
    break;
  } catch {
    if (i > 100) throw new Error(`anvil never answered on ${RPC}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

const assemblyArtifact = JSON.parse(
  readFileSync(new URL("../contracts/out/Assembly.sol/Assembly.json", import.meta.url), "utf8"),
);

await wallet.sendTransaction({ to: account.address, value: 0n });
await wallet.sendTransaction({ to: account.address, value: 0n });

// Use an address for local dev token
const dummyToken = "0x0000000000000000000000000000000000000001";

const deployHash = await wallet.deployContract({
  abi: assemblyArtifact.abi,
  bytecode: assemblyArtifact.bytecode.object,
  args: [dummyToken],
});
const deployed = await pub.waitForTransactionReceipt({ hash: deployHash });
const address = deployed.contractAddress;

const proposeHash = await wallet.writeContract({
  address,
  abi: assemblyArtifact.abi,
  functionName: "propose",
  args: ["Upgrade community treasury multisig", 7n * 86400n],
});
await pub.waitForTransactionReceipt({ hash: proposeHash });

writeFileSync(
  new URL("../.env.local", import.meta.url),
  [
    "# Written by scripts/local-stack.mjs. Not the testnet or mainnet config.",
    "NEXT_PUBLIC_BOTCHAIN_NETWORK=testnet",
    `NEXT_PUBLIC_BOHR_RPC=${RPC}`,
    `NEXT_PUBLIC_CONTRACT_968=${address}`,
    `NEXT_PUBLIC_DEPLOY_BLOCK_968=${deployed.blockNumber - 1n}`,
    "",
  ].join("\n"),
);

console.log(`chain       anvil ${CHAIN_ID} on ${RPC}`);
console.log(`contract    ${address}  (block ${deployed.blockNumber})`);
console.log(`proposal #1 "Upgrade community treasury multisig"`);
console.log("\n.env.local written. Start the app with: npm run dev");
