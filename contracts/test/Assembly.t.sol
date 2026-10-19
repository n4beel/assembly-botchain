// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Test} from "forge-std/Test.sol";
import {Assembly} from "../src/Assembly.sol";

/// @dev Minimal ERC-20 for testing. NOT for production.
contract MockToken {
  mapping(address => uint256) public balanceOf;
  mapping(address => mapping(address => uint256)) public allowance;

  string public name = "Mock";
  string public symbol = "MCK";
  uint8 public decimals = 18;
  uint256 public totalSupply;

  function mint(address to, uint256 amount) external {
    balanceOf[to] += amount;
    totalSupply += amount;
  }

  function approve(address spender, uint256 amount) external returns (bool) {
    allowance[msg.sender][spender] = amount;
    return true;
  }

  function transfer(address to, uint256 amount) external returns (bool) {
    require(balanceOf[msg.sender] >= amount, "insufficient");
    balanceOf[msg.sender] -= amount;
    balanceOf[to] += amount;
    return true;
  }

  function transferFrom(address from, address to, uint256 amount) external returns (bool) {
    require(balanceOf[from] >= amount, "insufficient");
    require(allowance[from][msg.sender] >= amount, "allowance");
    balanceOf[from] -= amount;
    allowance[from][msg.sender] -= amount;
    balanceOf[to] += amount;
    return true;
  }
}

contract AssemblyTest is Test {
  Assembly internal assembly_;
  MockToken internal token;

  address internal alice = address(0xA11CE);
  address internal bob = address(0xB0B);

  uint64 internal constant ONE_DAY = 1 days;

  function setUp() public {
    vm.warp(1_760_000_000);
    token = new MockToken();
    assembly_ = new Assembly(address(token));

    // Fund alice and bob
    token.mint(alice, 1_000e18);
    token.mint(bob, 1_000e18);

    // Approve the Assembly contract
    vm.prank(alice);
    token.approve(address(assembly_), type(uint256).max);
    vm.prank(bob);
    token.approve(address(assembly_), type(uint256).max);
  }

  // ── happy paths ──────────────────────────────────────────────────────────────

  function test_Propose() public {
    vm.prank(alice);
    uint256 id = assembly_.propose("Should we upgrade?", ONE_DAY);
    assertEq(id, 1, "first id");

    Assembly.Proposal memory p = assembly_.proposalOf(1);
    assertEq(p.description, "Should we upgrade?");
    assertEq(p.createdAt, uint64(block.timestamp));
    assertEq(p.deadline, uint64(block.timestamp) + ONE_DAY);
    assertEq(p.forVotes, 0);
    assertEq(p.againstVotes, 0);
  }

  function test_CastVote() public {
    vm.prank(alice);
    uint256 id = assembly_.propose("Increase fees?", ONE_DAY);

    uint256 aliceBefore = token.balanceOf(alice);
    vm.prank(alice);
    assembly_.castVote(id, true, 100e18);

    Assembly.Proposal memory p = assembly_.proposalOf(id);
    assertEq(p.forVotes, 100e18, "forVotes");
    assertEq(p.againstVotes, 0, "againstVotes");
    assertEq(token.balanceOf(alice), aliceBefore - 100e18, "alice lost tokens");
    assertEq(token.balanceOf(address(assembly_)), 100e18, "assembly holds tokens");
    assertTrue(assembly_.hasVoted(id, alice));
    assertEq(assembly_.depositedBy(id, alice), 100e18);
  }

  function test_CastVoteAgainst() public {
    vm.prank(alice);
    uint256 id = assembly_.propose("Decrease fees?", ONE_DAY);

    vm.prank(alice);
    assembly_.castVote(id, false, 200e18);

    Assembly.Proposal memory p = assembly_.proposalOf(id);
    assertEq(p.forVotes, 0, "forVotes");
    assertEq(p.againstVotes, 200e18, "againstVotes");
  }

  function test_WithdrawAfterClose() public {
    vm.prank(alice);
    uint256 id = assembly_.propose("Burn treasury?", ONE_DAY);

    vm.prank(alice);
    assembly_.castVote(id, true, 50e18);

    uint256 aliceBefore = token.balanceOf(alice);

    vm.warp(block.timestamp + ONE_DAY + 1);

    vm.prank(alice);
    assembly_.withdrawTokens(id);

    assertEq(token.balanceOf(alice), aliceBefore + 50e18, "alice got tokens back");
    assertEq(assembly_.depositedBy(id, alice), 0, "deposit cleared");
  }

  // ── guard tests ───────────────────────────────────────────────────────────────

  function test_CannotVoteTwice() public {
    vm.prank(alice);
    uint256 id = assembly_.propose("Twice?", ONE_DAY);

    vm.prank(alice);
    assembly_.castVote(id, true, 10e18);

    vm.expectRevert(abi.encodeWithSelector(Assembly.AlreadyVoted.selector, id));
    vm.prank(alice);
    assembly_.castVote(id, false, 10e18);
  }

  function test_CannotVoteAfterDeadline() public {
    vm.prank(alice);
    uint256 id = assembly_.propose("After deadline?", ONE_DAY);

    vm.warp(block.timestamp + ONE_DAY + 1);

    vm.expectRevert(abi.encodeWithSelector(Assembly.ProposalClosed.selector, id));
    vm.prank(alice);
    assembly_.castVote(id, true, 10e18);
  }

  function test_CannotWithdrawBeforeClose() public {
    vm.prank(alice);
    uint256 id = assembly_.propose("Too early?", ONE_DAY);

    vm.prank(alice);
    assembly_.castVote(id, true, 10e18);

    vm.expectRevert(abi.encodeWithSelector(Assembly.ProposalStillOpen.selector, id));
    vm.prank(alice);
    assembly_.withdrawTokens(id);
  }

  function test_ZeroToken() public {
    vm.expectRevert(Assembly.ZeroToken.selector);
    new Assembly(address(0));
  }

  function test_DurationTooShort() public {
    uint64 tooShort = assembly_.MIN_DURATION() - 1;
    vm.expectRevert(
      abi.encodeWithSelector(Assembly.DurationTooShort.selector, tooShort, assembly_.MIN_DURATION())
    );
    assembly_.propose("Too short", tooShort);
  }

  function test_DurationTooLong() public {
    uint64 tooLong = assembly_.MAX_DURATION() + 1;
    vm.expectRevert(
      abi.encodeWithSelector(Assembly.DurationTooLong.selector, tooLong, assembly_.MAX_DURATION())
    );
    assembly_.propose("Too long", tooLong);
  }

  function test_ZeroDeposit() public {
    vm.prank(alice);
    uint256 id = assembly_.propose("Zero deposit?", ONE_DAY);

    vm.expectRevert(Assembly.ZeroDeposit.selector);
    vm.prank(alice);
    assembly_.castVote(id, true, 0);
  }

  function test_ProposalClosed() public {
    vm.prank(alice);
    uint256 id = assembly_.propose("Closed?", ONE_DAY);

    vm.warp(block.timestamp + ONE_DAY + 1);

    vm.expectRevert(abi.encodeWithSelector(Assembly.ProposalClosed.selector, id));
    vm.prank(alice);
    assembly_.castVote(id, true, 10e18);
  }

  function test_ProposalStillOpen() public {
    vm.prank(alice);
    uint256 id = assembly_.propose("Still open?", ONE_DAY);

    vm.prank(alice);
    assembly_.castVote(id, true, 10e18);

    vm.expectRevert(abi.encodeWithSelector(Assembly.ProposalStillOpen.selector, id));
    vm.prank(alice);
    assembly_.withdrawTokens(id);
  }

  function test_NothingToWithdraw() public {
    vm.prank(alice);
    uint256 id = assembly_.propose("Nothing?", ONE_DAY);

    // bob never voted
    vm.warp(block.timestamp + ONE_DAY + 1);

    vm.expectRevert(abi.encodeWithSelector(Assembly.NothingToWithdraw.selector, id));
    vm.prank(bob);
    assembly_.withdrawTokens(id);
  }

  function test_NotFound() public {
    vm.expectRevert(abi.encodeWithSelector(Assembly.NotFound.selector, 999));
    assembly_.castVote(999, true, 1e18);
  }

  function test_NotFoundWithdraw() public {
    vm.expectRevert(abi.encodeWithSelector(Assembly.NotFound.selector, 999));
    assembly_.withdrawTokens(999);
  }

  // ── gas ceiling tests ─────────────────────────────────────────────────────────

  function test_GasCeiling_Propose() public {
    vm.prank(alice);
    uint256 before = gasleft();
    assembly_.propose("Gas ceiling test proposal description", ONE_DAY);
    uint256 used = before - gasleft();
    emit log_named_uint("propose() gas", used);
    assertLt(used, 140_000, "propose() exceeded gas ceiling");
  }

  function test_GasCeiling_CastVote() public {
    vm.prank(alice);
    uint256 id = assembly_.propose("Gas ceiling vote", ONE_DAY);

    vm.prank(alice);
    uint256 before = gasleft();
    assembly_.castVote(id, true, 100e18);
    uint256 used = before - gasleft();
    emit log_named_uint("castVote() gas", used);
    assertLt(used, 110_000, "castVote() exceeded gas ceiling");
  }

  // ── fuzz tests ────────────────────────────────────────────────────────────────

  function testFuzz_VoteWeightReturned(uint96 amount) public {
    vm.assume(amount > 0);

    token.mint(alice, amount);
    // alice already has max approval

    vm.prank(alice);
    uint256 id = assembly_.propose("Fuzz weight", ONE_DAY);

    uint256 aliceBefore = token.balanceOf(alice);

    vm.prank(alice);
    assembly_.castVote(id, true, amount);

    vm.warp(block.timestamp + ONE_DAY + 1);

    vm.prank(alice);
    assembly_.withdrawTokens(id);

    assertEq(token.balanceOf(alice), aliceBefore, "all tokens returned");
  }

  function testFuzz_TallyMatchesDeposits(uint96 amountFor, uint96 amountAgainst) public {
    vm.assume(amountFor > 0);
    vm.assume(amountAgainst > 0);

    token.mint(alice, amountFor);
    token.mint(bob, amountAgainst);

    vm.prank(alice);
    uint256 id = assembly_.propose("Fuzz tally", ONE_DAY);

    vm.prank(alice);
    assembly_.castVote(id, true, amountFor);

    vm.prank(bob);
    assembly_.castVote(id, false, amountAgainst);

    Assembly.Proposal memory p = assembly_.proposalOf(id);
    uint256 total = uint256(amountFor) + uint256(amountAgainst);
    assertEq(p.forVotes + p.againstVotes, total, "tally == total deposited");
    assertEq(token.balanceOf(address(assembly_)), total, "contract holds total");
  }
}
