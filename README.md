# Assembly

Token-weighted DAO voting on BOT Chain.

### BOT Chain mainnet (677) — live

| | |
|---|---|
| Contract | [`0x3f13E3EA326781CE3653E77016Fd209C80E2642c`](https://scan.botchain.ai/address/0x3f13E3EA326781CE3653E77016Fd209C80E2642c) · source verified |
| Deploy block | 27329598 |

### Bohr testnet (968) — live

| | |
|---|---|
| Contract | [`0x3f13E3EA326781CE3653E77016Fd209C80E2642c`](https://scan.bohr.life/address/0x3f13E3EA326781CE3653E77016Fd209C80E2642c) · source verified |
| Deploy block | 27397392 |

The site targets mainnet.

Governance token (a fixed-supply ERC-20 minted with Forge, same address on both chains):
[`0x8fE6135e2b49a4e6aDf382E88f8eB08397A6B72F`](https://scan.botchain.ai/address/0x8fE6135e2b49a4e6aDf382E88f8eB08397A6B72F)

Token faucet, so an address other than the deployer can vote — 10 GOV each, once:

| Network | Faucet |
|---|---|
| Mainnet | [`0xc606b07126eDECd9971394C660D8aD0C10fC3407`](https://scan.botchain.ai/address/0xc606b07126eDECd9971394C660D8aD0C10fC3407) |
| Bohr | [`0x924f02fF4cd08b13e27eae4BD303ab110F36052E`](https://scan.bohr.life/address/0x924f02fF4cd08b13e27eae4BD303ab110F36052E) |

---

## What it does
Assembly lets anyone create advisory proposals on BOT Chain. Token holders vote by locking tokens during the voting period. Once the deadline passes, voters withdraw their tokens regardless of outcome.

## Pairs with
[Forge](https://forge.botchain-apps.dev) for token creation.

## Vote-locking mechanism
- Reading `balanceOf` at vote time lets one holder vote, transfer tokens, and vote again from another address.
- Standard Forge tokens have no checkpointing snapshots.
- Therefore, Assembly requires voters to **deposit** tokens to vote and withdraw them after the vote closes.

## What it deliberately cannot do
- **No quorum**: proposals pass or fail by plurality, no minimum participation required
- **No on-chain execution**: results are advisory consensus — implementation is off-chain
- **No ownership**: the contract has no admin or recovery key
- **Token fixed**: the governance token address is set at deployment and cannot be changed
- **No vote modification**: one vote per address per proposal, no revoking mid-vote

## Gas
- `propose()`: ~130k gas (target: ~120k)
- `castVote()`: ~95k gas beyond ERC20 transfer (target: ~90k)
- `withdrawTokens()`: ~55k gas

## Honest limits
- Requires two transactions to vote: an ERC-20 `approve` followed by `castVote`
- If you forget to withdraw after a vote closes, your tokens remain safely in the contract until you call `withdrawTokens`
