// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

interface IERC20 {
  function transfer(address to, uint256 amount) external returns (bool);
  function balanceOf(address account) external view returns (uint256);
}

/// @title GovFaucet
/// @notice Hands out a fixed amount of the governance token, once per address.
///
/// @dev Assembly's governance token is a fixed-supply ERC-20 with no mint function — that is the
/// point of the token, and it is not going to change. The consequence is that the whole supply
/// starts in one address, so nobody else can ever cast a vote, which makes the app impossible to
/// try and impossible to review. This exists to solve exactly that and nothing else.
///
/// What it deliberately cannot do:
/// - No owner, no admin, no pause. Nobody can stop it or drain it.
/// - No refill function. It holds whatever was sent to it at deployment and no more; when that
///   runs out it is empty, permanently. Anyone wanting it refilled sends the token to it directly.
/// - No per-address top-up. One claim per address, forever. Sybils are cheap on any chain, so this
///   is a convenience rather than a defence — it limits accidents, not determined abuse.
contract GovFaucet {
  /// @notice The token handed out.
  IERC20 public immutable token;

  /// @notice How much each address receives, in the token's smallest unit.
  uint256 public immutable amount;

  /// @notice Whether an address has already claimed.
  mapping(address claimer => bool) public claimed;

  event Claimed(address indexed who, uint256 amount);

  error AlreadyClaimed(address who);
  error FaucetEmpty(uint256 held, uint256 needed);
  error TransferFailed(address to, uint256 amount);
  error ZeroAddress();
  error ZeroAmount();

  constructor(address token_, uint256 amount_) {
    if (token_ == address(0)) revert ZeroAddress();
    if (amount_ == 0) revert ZeroAmount();
    token = IERC20(token_);
    amount = amount_;
  }

  /// @notice Claim the fixed amount. Once per address.
  function claim() external {
    if (claimed[msg.sender]) revert AlreadyClaimed(msg.sender);

    uint256 held = token.balanceOf(address(this));
    if (held < amount) revert FaucetEmpty(held, amount);

    // Effects before the interaction, as everywhere else in this family.
    claimed[msg.sender] = true;

    emit Claimed(msg.sender, amount);

    bool ok = token.transfer(msg.sender, amount);
    if (!ok) revert TransferFailed(msg.sender, amount);
  }

  /// @notice How many more addresses can claim before it is empty.
  function remainingClaims() external view returns (uint256) {
    return token.balanceOf(address(this)) / amount;
  }
}
