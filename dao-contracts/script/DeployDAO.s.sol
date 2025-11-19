// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "../src/MinimalForwarder.sol";
import "../src/SimpleDAO.sol";

contract DeployDAO is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        uint256 minimumBalance = vm.envOr("MINIMUM_BALANCE", uint256(0.1 ether));
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy MinimalForwarder first
        MinimalForwarder forwarder = new MinimalForwarder();
        console.log("MinimalForwarder deployed to:", address(forwarder));
        
        // Deploy DAOVoting with forwarder address
        DAOVoting dao = new DAOVoting(address(forwarder), minimumBalance);
        console.log("DAOVoting deployed to:", address(dao));
        console.log("Minimum balance for voting:", minimumBalance);
        
        vm.stopBroadcast();
    }
}
