// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/MinimalForwarder.sol";

contract TestRecipient {
    address public lastSender;
    uint256 public callCount;
    
    event MessageReceived(address sender, string message);
    
    function receiveMessage(string memory message) public {
        lastSender = msg.sender;
        callCount++;
        emit MessageReceived(msg.sender, message);
    }
    
    function getSender() public view returns (address) {
        return msg.sender;
    }
}

contract MinimalForwarderTest is Test {
    MinimalForwarder public forwarder;
    TestRecipient public recipient;
    
    uint256 public userPrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    address public user;
    address public relayer = address(0x5678);
    
    function setUp() public {
        user = vm.addr(userPrivateKey);
        forwarder = new MinimalForwarder();
        recipient = new TestRecipient();
        
        vm.deal(user, 1 ether);
        vm.deal(relayer, 1 ether);
    }
    
    function testGetNonce() public {
        assertEq(forwarder.getNonce(user), 0);
    }
    
    function testVerifyValidSignature() public {
        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: user,
            to: address(recipient),
            value: 0,
            gas: 100000,
            nonce: 0,
            data: abi.encodeWithSignature("receiveMessage(string)", "Hello World")
        });
        
        bytes32 digest = forwarder.getTypedDataHash(req);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        assertTrue(forwarder.verify(req, signature));
    }
    
    function testVerifyInvalidSignature() public {
        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: user,
            to: address(recipient),
            value: 0,
            gas: 100000,
            nonce: 0,
            data: abi.encodeWithSignature("receiveMessage(string)", "Hello World")
        });
        
        bytes memory invalidSignature = new bytes(65);
        
        assertFalse(forwarder.verify(req, invalidSignature));
    }
    
    function testExecuteMetaTransaction() public {
        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: user,
            to: address(recipient),
            value: 0,
            gas: 100000,
            nonce: 0,
            data: abi.encodeWithSignature("receiveMessage(string)", "Hello World")
        });
        
        bytes32 digest = forwarder.getTypedDataHash(req);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        vm.prank(relayer);
        forwarder.execute(req, signature);
        
        assertEq(forwarder.getNonce(user), 1);
        assertEq(recipient.callCount(), 1);
    }
    
    function testExecuteInvalidSignatureFails() public {
        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: user,
            to: address(recipient),
            value: 0,
            gas: 100000,
            nonce: 0,
            data: abi.encodeWithSignature("receiveMessage(string)", "Hello World")
        });
        
        bytes memory invalidSignature = new bytes(65);
        
        vm.prank(relayer);
        vm.expectRevert();
        forwarder.execute(req, invalidSignature);
    }
    
    function testNonceIncrementsAfterExecution() public {
        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: user,
            to: address(recipient),
            value: 0,
            gas: 100000,
            nonce: 0,
            data: abi.encodeWithSignature("receiveMessage(string)", "Hello World")
        });
        
        bytes32 digest = forwarder.getTypedDataHash(req);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        assertEq(forwarder.getNonce(user), 0);
        
        vm.prank(relayer);
        forwarder.execute(req, signature);
        
        assertEq(forwarder.getNonce(user), 1);
    }
    
    function testReplayAttackPrevention() public {
        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: user,
            to: address(recipient),
            value: 0,
            gas: 100000,
            nonce: 0,
            data: abi.encodeWithSignature("receiveMessage(string)", "Hello World")
        });
        
        bytes32 digest = forwarder.getTypedDataHash(req);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        // First execution should succeed
        vm.prank(relayer);
        forwarder.execute(req, signature);
        
        // Second execution with same nonce should fail
        vm.prank(relayer);
        vm.expectRevert("Invalid nonce");
        forwarder.execute(req, signature);
    }
}
