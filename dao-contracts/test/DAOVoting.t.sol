// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../src/SimpleDAO.sol";
import "../src/MinimalForwarder.sol";

contract DAOVotingTest is Test {
    DAOVoting public dao;
    MinimalForwarder public forwarder;
    
    address public user1;
    address public user2;
    address public user3;
    address public recipient = address(0x999);
    address public relayer = address(0xABC);
    
    uint256 public constant MINIMUM_BALANCE = 1 ether;
    uint256 public constant VOTING_DURATION = 7 days;
    
    // Private keys for gasless transactions
    uint256 public user1PrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    uint256 public user2PrivateKey = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
    
    function setUp() public {
        user1 = vm.addr(user1PrivateKey);
        user2 = vm.addr(user2PrivateKey);
        user3 = address(0x3);
        
        forwarder = new MinimalForwarder();
        dao = new DAOVoting(address(forwarder), MINIMUM_BALANCE);
        
        // Fund users
        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);
        vm.deal(user3, 100 ether);
        vm.deal(relayer, 100 ether);
    }
    
    function testFundDAO() public {
        vm.prank(user1);
        dao.fundDAO{value: 10 ether}();
        
        assertEq(dao.getUserBalance(user1), 10 ether);
        assertEq(dao.getTotalDeposited(), 10 ether);
        assertEq(address(dao).balance, 10 ether);
    }
    
    function testReceiveEther() public {
        vm.prank(user1);
        (bool success, ) = address(dao).call{value: 5 ether}("");
        assertTrue(success);
        
        assertEq(dao.getUserBalance(user1), 5 ether);
        assertEq(dao.getTotalDeposited(), 5 ether);
    }
    
    function testCreateProposal() public {
        // Fund DAO first
        vm.prank(user1);
        dao.fundDAO{value: 20 ether}();
        
        // Create proposal (user1 has 100% of funds, more than 10% required)
        vm.prank(user1);
        uint256 proposalId = dao.createProposal(recipient, 5 ether, VOTING_DURATION);
        
        assertEq(proposalId, 1);
        assertEq(dao.proposalCount(), 1);
        
        DAOVoting.Proposal memory proposal = dao.getProposal(proposalId);
        assertEq(proposal.id, 1);
        assertEq(proposal.recipient, recipient);
        assertEq(proposal.amount, 5 ether);
        assertEq(proposal.executed, false);
    }
    
    function testCreateProposalFailsWithInsufficientBalance() public {
        // Fund DAO with user1
        vm.prank(user1);
        dao.fundDAO{value: 20 ether}();
        
        // user2 has no balance, should fail
        vm.prank(user2);
        vm.expectRevert("Insufficient balance to create proposal");
        dao.createProposal(recipient, 5 ether, VOTING_DURATION);
    }
    
    function testVote() public {
        // Fund DAO
        vm.prank(user1);
        dao.fundDAO{value: 20 ether}();
        
        vm.prank(user2);
        dao.fundDAO{value: 5 ether}();
        
        // Create proposal
        vm.prank(user1);
        uint256 proposalId = dao.createProposal(recipient, 5 ether, VOTING_DURATION);
        
        // Vote FOR
        vm.prank(user1);
        dao.vote(proposalId, DAOVoting.VoteType.FOR);
        
        // Vote AGAINST
        vm.prank(user2);
        dao.vote(proposalId, DAOVoting.VoteType.AGAINST);
        
        DAOVoting.Proposal memory proposal = dao.getProposal(proposalId);
        assertEq(proposal.forVotes, 1);
        assertEq(proposal.againstVotes, 1);
        assertEq(proposal.abstainVotes, 0);
    }
    
    function testChangeVote() public {
        // Fund DAO
        vm.prank(user1);
        dao.fundDAO{value: 20 ether}();
        
        vm.prank(user2);
        dao.fundDAO{value: 5 ether}();
        
        // Create proposal
        vm.prank(user1);
        uint256 proposalId = dao.createProposal(recipient, 5 ether, VOTING_DURATION);
        
        // Vote FOR
        vm.prank(user1);
        dao.vote(proposalId, DAOVoting.VoteType.FOR);
        
        DAOVoting.Proposal memory proposal = dao.getProposal(proposalId);
        assertEq(proposal.forVotes, 1);
        assertEq(proposal.againstVotes, 0);
        
        // Change vote to AGAINST
        vm.prank(user1);
        dao.vote(proposalId, DAOVoting.VoteType.AGAINST);
        
        proposal = dao.getProposal(proposalId);
        assertEq(proposal.forVotes, 0);
        assertEq(proposal.againstVotes, 1);
    }
    
    function testVoteFailsWithInsufficientBalance() public {
        // Fund DAO
        vm.prank(user1);
        dao.fundDAO{value: 20 ether}();
        
        // Create proposal
        vm.prank(user1);
        uint256 proposalId = dao.createProposal(recipient, 5 ether, VOTING_DURATION);
        
        // user2 has no balance, should fail to vote
        vm.prank(user2);
        vm.expectRevert("Insufficient balance to vote");
        dao.vote(proposalId, DAOVoting.VoteType.FOR);
    }
    
    function testExecuteProposal() public {
        // Fund DAO
        vm.prank(user1);
        dao.fundDAO{value: 20 ether}();
        
        vm.prank(user2);
        dao.fundDAO{value: 5 ether}();
        
        // Create proposal
        vm.prank(user1);
        uint256 proposalId = dao.createProposal(recipient, 5 ether, VOTING_DURATION);
        
        // Vote FOR (2 votes)
        vm.prank(user1);
        dao.vote(proposalId, DAOVoting.VoteType.FOR);
        
        vm.prank(user2);
        dao.vote(proposalId, DAOVoting.VoteType.FOR);
        
        // Fast forward past voting deadline + execution delay
        vm.warp(block.timestamp + VOTING_DURATION + 1 days + 1);
        
        uint256 recipientBalanceBefore = recipient.balance;
        
        // Execute proposal
        dao.executeProposal(proposalId);
        
        assertEq(recipient.balance, recipientBalanceBefore + 5 ether);
        assertEq(dao.getTotalDeposited(), 20 ether); // 25 - 5
        
        DAOVoting.Proposal memory proposal = dao.getProposal(proposalId);
        assertTrue(proposal.executed);
    }
    
    function testExecuteProposalFailsBeforeDeadline() public {
        // Fund DAO
        vm.prank(user1);
        dao.fundDAO{value: 20 ether}();
        
        // Create proposal
        vm.prank(user1);
        uint256 proposalId = dao.createProposal(recipient, 5 ether, VOTING_DURATION);
        
        // Vote FOR
        vm.prank(user1);
        dao.vote(proposalId, DAOVoting.VoteType.FOR);
        
        // Try to execute before deadline
        vm.expectRevert("Voting period not ended");
        dao.executeProposal(proposalId);
    }
    
    function testExecuteProposalFailsWithoutMajority() public {
        // Fund DAO
        vm.prank(user1);
        dao.fundDAO{value: 20 ether}();
        
        vm.prank(user2);
        dao.fundDAO{value: 5 ether}();
        
        // Create proposal
        vm.prank(user1);
        uint256 proposalId = dao.createProposal(recipient, 5 ether, VOTING_DURATION);
        
        // Vote AGAINST (1 vote)
        vm.prank(user1);
        dao.vote(proposalId, DAOVoting.VoteType.AGAINST);
        
        // Fast forward past voting deadline + execution delay
        vm.warp(block.timestamp + VOTING_DURATION + 1 days + 1);
        
        // Try to execute without majority
        vm.expectRevert("Proposal not approved");
        dao.executeProposal(proposalId);
    }
    
    function testCanExecute() public {
        // Fund DAO
        vm.prank(user1);
        dao.fundDAO{value: 20 ether}();
        
        // Create proposal
        vm.prank(user1);
        uint256 proposalId = dao.createProposal(recipient, 5 ether, VOTING_DURATION);
        
        // Should not be executable yet
        assertFalse(dao.canExecute(proposalId));
        
        // Vote FOR
        vm.prank(user1);
        dao.vote(proposalId, DAOVoting.VoteType.FOR);
        
        // Still not executable (deadline not passed)
        assertFalse(dao.canExecute(proposalId));
        
        // Fast forward past voting deadline + execution delay
        vm.warp(block.timestamp + VOTING_DURATION + 1 days + 1);
        
        // Now should be executable
        assertTrue(dao.canExecute(proposalId));
        
        // Execute
        dao.executeProposal(proposalId);
        
        // Should not be executable anymore
        assertFalse(dao.canExecute(proposalId));
    }
    
    // ========== GASLESS TRANSACTION TESTS (EIP-2771) ==========
    
    function testGaslessVoteWithForwarder() public {
        // Setup: Fund DAO
        vm.prank(user1);
        dao.fundDAO{value: 20 ether}();
        
        vm.prank(user2);
        dao.fundDAO{value: 5 ether}();
        
        // Create proposal
        vm.prank(user1);
        uint256 proposalId = dao.createProposal(recipient, 5 ether, VOTING_DURATION);
        
        // Prepare gasless vote from user2
        bytes memory voteData = abi.encodeWithSelector(
            dao.vote.selector,
            proposalId,
            DAOVoting.VoteType.FOR
        );
        
        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: user2,
            to: address(dao),
            value: 0,
            gas: 200000,
            nonce: forwarder.getNonce(user2),
            data: voteData
        });
        
        // Sign the request
        bytes32 digest = forwarder.getTypedDataHash(req);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(user2PrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        // Relayer executes the gasless vote
        vm.prank(relayer);
        forwarder.execute(req, signature);
        
        // Verify vote was recorded
        DAOVoting.Proposal memory proposal = dao.getProposal(proposalId);
        assertEq(proposal.forVotes, 1);
        assertEq(uint256(dao.getUserVote(proposalId, user2)), uint256(DAOVoting.VoteType.FOR));
    }
    
    function testGaslessCreateProposalWithForwarder() public {
        // Setup: Fund DAO
        vm.prank(user1);
        dao.fundDAO{value: 20 ether}();
        
        // Prepare gasless create proposal from user1
        bytes memory proposalData = abi.encodeWithSelector(
            dao.createProposal.selector,
            recipient,
            5 ether,
            VOTING_DURATION
        );
        
        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: user1,
            to: address(dao),
            value: 0,
            gas: 300000,
            nonce: forwarder.getNonce(user1),
            data: proposalData
        });
        
        // Sign the request
        bytes32 digest = forwarder.getTypedDataHash(req);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(user1PrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        // Relayer executes the gasless proposal creation
        vm.prank(relayer);
        forwarder.execute(req, signature);
        
        // Verify proposal was created
        assertEq(dao.proposalCount(), 1);
        DAOVoting.Proposal memory proposal = dao.getProposal(1);
        assertEq(proposal.recipient, recipient);
        assertEq(proposal.amount, 5 ether);
    }
    
    function testGaslessVoteChangeWithForwarder() public {
        // Setup: Fund DAO
        vm.prank(user1);
        dao.fundDAO{value: 20 ether}();
        
        vm.prank(user2);
        dao.fundDAO{value: 5 ether}();
        
        // Create proposal
        vm.prank(user1);
        uint256 proposalId = dao.createProposal(recipient, 5 ether, VOTING_DURATION);
        
        // First gasless vote: FOR
        bytes memory voteDataFor = abi.encodeWithSelector(
            dao.vote.selector,
            proposalId,
            DAOVoting.VoteType.FOR
        );
        
        MinimalForwarder.ForwardRequest memory reqFor = MinimalForwarder.ForwardRequest({
            from: user2,
            to: address(dao),
            value: 0,
            gas: 200000,
            nonce: forwarder.getNonce(user2),
            data: voteDataFor
        });
        
        bytes32 digestFor = forwarder.getTypedDataHash(reqFor);
        (uint8 vFor, bytes32 rFor, bytes32 sFor) = vm.sign(user2PrivateKey, digestFor);
        bytes memory signatureFor = abi.encodePacked(rFor, sFor, vFor);
        
        vm.prank(relayer);
        forwarder.execute(reqFor, signatureFor);
        
        // Verify first vote
        DAOVoting.Proposal memory proposal = dao.getProposal(proposalId);
        assertEq(proposal.forVotes, 1);
        assertEq(proposal.againstVotes, 0);
        
        // Second gasless vote: AGAINST (change vote)
        bytes memory voteDataAgainst = abi.encodeWithSelector(
            dao.vote.selector,
            proposalId,
            DAOVoting.VoteType.AGAINST
        );
        
        MinimalForwarder.ForwardRequest memory reqAgainst = MinimalForwarder.ForwardRequest({
            from: user2,
            to: address(dao),
            value: 0,
            gas: 200000,
            nonce: forwarder.getNonce(user2),
            data: voteDataAgainst
        });
        
        bytes32 digestAgainst = forwarder.getTypedDataHash(reqAgainst);
        (uint8 vAgainst, bytes32 rAgainst, bytes32 sAgainst) = vm.sign(user2PrivateKey, digestAgainst);
        bytes memory signatureAgainst = abi.encodePacked(rAgainst, sAgainst, vAgainst);
        
        vm.prank(relayer);
        forwarder.execute(reqAgainst, signatureAgainst);
        
        // Verify vote changed
        proposal = dao.getProposal(proposalId);
        assertEq(proposal.forVotes, 0);
        assertEq(proposal.againstVotes, 1);
    }
    
    function testGaslessMultipleUsersVoting() public {
        // Setup: Fund DAO
        vm.prank(user1);
        dao.fundDAO{value: 20 ether}();
        
        vm.prank(user2);
        dao.fundDAO{value: 5 ether}();
        
        // Create proposal
        vm.prank(user1);
        uint256 proposalId = dao.createProposal(recipient, 5 ether, VOTING_DURATION);
        
        // User1 votes gasless FOR
        {
            bytes memory vote1Data = abi.encodeWithSelector(
                dao.vote.selector,
                proposalId,
                DAOVoting.VoteType.FOR
            );
            
            MinimalForwarder.ForwardRequest memory req1 = MinimalForwarder.ForwardRequest({
                from: user1,
                to: address(dao),
                value: 0,
                gas: 200000,
                nonce: forwarder.getNonce(user1),
                data: vote1Data
            });
            
            bytes32 digest1 = forwarder.getTypedDataHash(req1);
            (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(user1PrivateKey, digest1);
            bytes memory signature1 = abi.encodePacked(r1, s1, v1);
            
            vm.prank(relayer);
            forwarder.execute(req1, signature1);
        }
        
        // User2 votes gasless AGAINST
        {
            bytes memory vote2Data = abi.encodeWithSelector(
                dao.vote.selector,
                proposalId,
                DAOVoting.VoteType.AGAINST
            );
            
            MinimalForwarder.ForwardRequest memory req2 = MinimalForwarder.ForwardRequest({
                from: user2,
                to: address(dao),
                value: 0,
                gas: 200000,
                nonce: forwarder.getNonce(user2),
                data: vote2Data
            });
            
            bytes32 digest2 = forwarder.getTypedDataHash(req2);
            (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(user2PrivateKey, digest2);
            bytes memory signature2 = abi.encodePacked(r2, s2, v2);
            
            vm.prank(relayer);
            forwarder.execute(req2, signature2);
        }
        
        // Verify both votes
        DAOVoting.Proposal memory proposal = dao.getProposal(proposalId);
        assertEq(proposal.forVotes, 1);
        assertEq(proposal.againstVotes, 1);
    }
}
