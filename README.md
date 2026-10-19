# Assembly

Token-weighted DAO voting on BOT Chain.

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
