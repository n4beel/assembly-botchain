// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Test} from "forge-std/Test.sol";
import {GovFaucet} from "../src/GovFaucet.sol";

/// A fixed-supply token with the same shape as the one Forge mints.
contract MockToken {
  mapping(address => uint256) public balanceOf;
  bool public failTransfers;

  constructor(address to, uint256 supply) {
    balanceOf[to] = supply;
  }

  function setFailTransfers(bool v) external {
    failTransfers = v;
  }

  function transfer(address to, uint256 value) external returns (bool) {
    if (failTransfers) return false;
    require(balanceOf[msg.sender] >= value, "balance");
    balanceOf[msg.sender] -= value;
    balanceOf[to] += value;
    return true;
  }
}

contract GovFaucetTest is Test {
  MockToken token;
  GovFaucet faucet;

  address alice = address(0xA11CE);
  address bob = address(0xB0B);

  uint256 constant DROP = 10e18;

  function setUp() public {
    token = new MockToken(address(this), 1000e18);
    faucet = new GovFaucet(address(token), DROP);
    token.transfer(address(faucet), 100e18);
  }

  function test_claimPaysTheFixedAmount() public {
    vm.prank(alice);
    faucet.claim();
    assertEq(token.balanceOf(alice), DROP);
  }

  function test_secondClaimReverts() public {
    vm.startPrank(alice);
    faucet.claim();
    vm.expectRevert(abi.encodeWithSelector(GovFaucet.AlreadyClaimed.selector, alice));
    faucet.claim();
    vm.stopPrank();
  }

  function test_differentAddressesEachClaimOnce() public {
    vm.prank(alice);
    faucet.claim();
    vm.prank(bob);
    faucet.claim();
    assertEq(token.balanceOf(alice), DROP);
    assertEq(token.balanceOf(bob), DROP);
  }

  function test_emptyFaucetRevertsRatherThanPayingNothing() public {
    // Drain it to below one drop.
    for (uint160 i = 1; i <= 10; i++) {
      vm.prank(address(i));
      faucet.claim();
    }
    assertEq(faucet.remainingClaims(), 0);
    vm.prank(alice);
    vm.expectRevert(abi.encodeWithSelector(GovFaucet.FaucetEmpty.selector, 0, DROP));
    faucet.claim();
  }

  function test_remainingClaimsCountsDown() public {
    assertEq(faucet.remainingClaims(), 10);
    vm.prank(alice);
    faucet.claim();
    assertEq(faucet.remainingClaims(), 9);
  }

  function test_aFailedTransferRevertsTheWholeClaim() public {
    token.setFailTransfers(true);
    vm.prank(alice);
    vm.expectRevert(abi.encodeWithSelector(GovFaucet.TransferFailed.selector, alice, DROP));
    faucet.claim();
    // And the claim was not recorded, so the address can try again once it works.
    token.setFailTransfers(false);
    vm.prank(alice);
    faucet.claim();
    assertEq(token.balanceOf(alice), DROP);
  }

  function test_constructorRejectsNonsense() public {
    vm.expectRevert(GovFaucet.ZeroAddress.selector);
    new GovFaucet(address(0), DROP);
    vm.expectRevert(GovFaucet.ZeroAmount.selector);
    new GovFaucet(address(token), 0);
  }
}
