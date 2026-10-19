// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/// @title Assembly
/// @notice Token-weighted advisory DAO voting on BOT Chain.
///
/// @dev Vote-locking: voters DEPOSIT tokens to cast a vote and WITHDRAW after the proposal closes.
/// This avoids the double-vote attack possible with bare balanceOf reads on tokens that lack
/// ERC20Votes checkpointing (e.g. tokens from forge-botchain).
///
/// What this contract cannot do:
/// - No quorum: proposals pass or fail by plurality, no minimum participation enforced on-chain.
/// - No on-chain execution: results are advisory; implementation is entirely off-chain.
/// - No owner: no admin, no upgrade path, no pause, no recovery hatch.
/// - Token fixed at deployment: the governance token is set in the constructor and cannot change.
/// - No vote change: one vote per address per proposal; there is no revocation path.
interface IERC20 {
  function transferFrom(address from, address to, uint256 amount) external returns (bool);
  function transfer(address to, uint256 amount) external returns (bool);
}

contract Assembly {
  uint64 public constant MIN_DURATION = 1 hours;
  uint64 public constant MAX_DURATION = 30 days;

  /// @notice The governance token locked by voters.
  address public immutable token;

  struct Proposal {
    string description;
    uint64 createdAt;
    uint64 deadline;
    uint256 forVotes;
    uint256 againstVotes;
  }

  mapping(uint256 id => Proposal) private _proposals;
  /// @notice How many tokens a given address deposited on a given proposal.
  mapping(uint256 id => mapping(address => uint256)) public depositedBy;
  /// @notice Whether a given address has cast a vote on a given proposal.
  mapping(uint256 id => mapping(address => bool)) public hasVoted;
  uint256 private _nextId;

  constructor(address token_) {
    if (token_ == address(0)) revert ZeroToken();
    token = token_;
  }

  error ZeroToken();
  error DurationTooShort(uint64 duration, uint64 min);
  error DurationTooLong(uint64 duration, uint64 max);
  error NotFound(uint256 id);
  error ProposalClosed(uint256 id);
  error ProposalStillOpen(uint256 id);
  error AlreadyVoted(uint256 id);
  error ZeroDeposit();
  error NothingToWithdraw(uint256 id);
  error TransferFailed(uint256 id);

  event ProposalCreated(uint256 indexed id, address indexed proposer, string description, uint64 deadline);
  event VoteCast(uint256 indexed id, address indexed voter, bool support, uint256 amount);
  event TokensWithdrawn(uint256 indexed id, address indexed voter, uint256 amount);

  /// @notice Create a new advisory proposal.
  /// @param description Human-readable description of the proposal.
  /// @param duration Voting window in seconds; must be between MIN_DURATION and MAX_DURATION.
  /// @return id The sequential proposal ID (starts at 1).
  function propose(string calldata description, uint64 duration) external returns (uint256 id) {
    if (duration < MIN_DURATION) revert DurationTooShort(duration, MIN_DURATION);
    if (duration > MAX_DURATION) revert DurationTooLong(duration, MAX_DURATION);
    id = ++_nextId;
    uint64 deadline = uint64(block.timestamp) + duration;
    _proposals[id] = Proposal({
      description: description,
      createdAt: uint64(block.timestamp),
      deadline: deadline,
      forVotes: 0,
      againstVotes: 0
    });
    emit ProposalCreated(id, msg.sender, description, deadline);
  }

  /// @notice Lock tokens and cast a vote.
  /// @dev Requires a prior ERC-20 approval. Tokens are held by this contract until the proposal
  /// closes. One vote per address; no revocation. Amount is the vote weight.
  function castVote(uint256 id, bool support, uint256 amount) external {
    Proposal storage p = _proposals[id];
    if (p.createdAt == 0) revert NotFound(id);
    if (block.timestamp > p.deadline) revert ProposalClosed(id);
    if (hasVoted[id][msg.sender]) revert AlreadyVoted(id);
    if (amount == 0) revert ZeroDeposit();
    bool ok = IERC20(token).transferFrom(msg.sender, address(this), amount);
    if (!ok) revert TransferFailed(id);
    depositedBy[id][msg.sender] = amount;
    hasVoted[id][msg.sender] = true;
    if (support) {
      p.forVotes += amount;
    } else {
      p.againstVotes += amount;
    }
    emit VoteCast(id, msg.sender, support, amount);
  }

  /// @notice Withdraw deposited tokens after the proposal closes.
  /// @dev Pull-only. Anyone who voted may call this after the deadline, regardless of outcome.
  /// If a voter never calls this after voting, their tokens remain locked here permanently —
  /// there is no admin recovery path and no forced release.
  function withdrawTokens(uint256 id) external {
    Proposal storage p = _proposals[id];
    if (p.createdAt == 0) revert NotFound(id);
    if (block.timestamp <= p.deadline) revert ProposalStillOpen(id);
    uint256 amount = depositedBy[id][msg.sender];
    if (amount == 0) revert NothingToWithdraw(id);
    depositedBy[id][msg.sender] = 0;
    bool ok = IERC20(token).transfer(msg.sender, amount);
    if (!ok) revert TransferFailed(id);
    emit TokensWithdrawn(id, msg.sender, amount);
  }

  /// @notice Read a proposal. Returns a zero-value struct if the id does not exist.
  function proposalOf(uint256 id) external view returns (Proposal memory) {
    return _proposals[id];
  }
}
