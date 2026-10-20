// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Script, console2} from "forge-std/Script.sol";
import {GovFaucet} from "../src/GovFaucet.sol";

/// Deploys the faucet. Funding it is a separate transfer, so the amount sent is a decision taken
/// at the time rather than baked into a script.
contract DeployFaucet is Script {
  function run() external {
    uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
    address token = vm.envAddress("GOVERNANCE_TOKEN");
    uint256 amount = vm.envOr("FAUCET_AMOUNT", uint256(10e18));

    vm.startBroadcast(deployerKey);
    GovFaucet deployed = new GovFaucet(token, amount);
    vm.stopBroadcast();

    console2.log("chain id  ", block.chainid);
    console2.log("faucet    ", address(deployed));
    console2.log("token     ", token);
    console2.log("per claim ", amount);
    console2.log("");
    console2.log("Fund it by transferring the token to the faucet address, then set:");
    console2.log(
      string.concat("NEXT_PUBLIC_FAUCET_", vm.toString(block.chainid), "=", vm.toString(address(deployed)))
    );
  }
}
