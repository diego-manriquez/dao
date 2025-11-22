// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/metatx/ERC2771Context.sol";

/**
 * @title DAOVoting
 * @dev DAO contract with proposal management and voting system
 * Supports gasless voting via EIP-2771 meta-transactions
 */
contract DAOVoting is ERC2771Context {
    enum VoteType {
        ABSTAIN,
        FOR,
        AGAINST
    }

    struct Proposal {
        uint256 id;
        address recipient;
        uint256 amount;
        uint256 votingDeadline;
        uint256 executionDelay;
        bool executed;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        string description;
    }

    uint256 public proposalCount;
    uint256 public minimumBalance;
    uint256 public totalDeposited; // Total balance deposited by all users
    uint256 public constant PROPOSAL_CREATION_THRESHOLD = 10; // 10% of contract balance
    uint256 public constant EXECUTION_DELAY = 1 days;

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => VoteType)) public votes;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(address => uint256) public balances; // Balance of each user in the DAO

    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed creator,
        address recipient,
        uint256 amount,
        uint256 votingDeadline,
        string description
    );
    event Voted(
        uint256 indexed proposalId,
        address indexed voter,
        VoteType voteType
    );
    event ProposalExecuted(
        uint256 indexed proposalId,
        address recipient,
        uint256 amount
    );
    event FundsDeposited(address indexed from, uint256 amount);

    constructor(    
        address trustedForwarder,
        uint256 _minimumBalance
    ) ERC2771Context(trustedForwarder) {
        minimumBalance = _minimumBalance;
    }

    function name() public pure returns (string memory) {
        return "DAO Voting Token";
    }

    function symbol() public pure returns (string memory) {
        return "DAO";
    }

    function decimals() public pure returns (uint8) {
        return 18;
    }

    /**
     * @dev Allows anyone to deposit ETH to the DAO treasury
     */
    function fundDAO() external payable {
        require(msg.value > 0, "Must send ETH");
        address sender = _msgSender();
        balances[sender] += msg.value;
        totalDeposited += msg.value;
        emit FundsDeposited(sender, msg.value);
    }

    /**
     * @dev Fallback function to receive ETH
     */
    receive() external payable {
        balances[msg.sender] += msg.value;
        totalDeposited += msg.value;
        emit FundsDeposited(msg.sender, msg.value);
    }

    /**
     * @dev Fallback function when no function matches
     */
    fallback() external payable {
        if (msg.value > 0) {
            balances[msg.sender] += msg.value;
            totalDeposited += msg.value;
            emit FundsDeposited(msg.sender, msg.value);
        }
    }

    /**
     * @dev Create a new proposal
     * Requires sender to have at least 10% of contract balance
     */
    function createProposal(
        address _recipient,
        uint256 _amount,
        uint256 _votingDuration
    ) external returns (uint256) {
        return createProposalWithDescription(_recipient, _amount, _votingDuration, "");
    }

    /**
     * @dev Create a new proposal with description
     * Requires sender to have at least 10% of contract balance
     */
    function createProposalWithDescription(
        address _recipient,
        uint256 _amount,
        uint256 _votingDuration,
        string memory _description
    ) public returns (uint256) {
        address sender = _msgSender();

        // Check if sender has enough balance in the DAO (at least 10% of total deposited)
        uint256 requiredBalance = (totalDeposited *
            PROPOSAL_CREATION_THRESHOLD) / 100;
        require(
            balances[sender] >= requiredBalance,
            "Insufficient balance to create proposal"
        );
        require(_recipient != address(0), "Invalid recipient");
        require(_amount > 0, "Amount must be greater than 0");
        require(_amount <= totalDeposited, "Insufficient DAO funds");
        require(_votingDuration > 0, "Voting duration must be greater than 0");

        proposalCount++;
        uint256 proposalId = proposalCount;

        proposals[proposalId] = Proposal({
            id: proposalId,
            recipient: _recipient,
            amount: _amount,
            votingDeadline: block.timestamp + _votingDuration,
            executionDelay: block.timestamp + _votingDuration + EXECUTION_DELAY,
            executed: false,
            forVotes: 0,
            againstVotes: 0,
            abstainVotes: 0,
            description: _description
        });

        emit ProposalCreated(
            proposalId,
            sender,
            _recipient,
            _amount,
            proposals[proposalId].votingDeadline,
            _description
        );

        return proposalId;
    }

    /**
     * @dev Vote on a proposal
     * Requires minimum balance and can change vote until deadline
     */
    function vote(uint256 _proposalId, VoteType _voteType) external {
        address sender = _msgSender();

        require(
            _proposalId > 0 && _proposalId <= proposalCount,
            "Invalid proposal ID"
        );
        require(
            balances[sender] >= minimumBalance,
            "Insufficient balance to vote"
        );

        Proposal storage proposal = proposals[_proposalId];
        require(
            block.timestamp < proposal.votingDeadline,
            "Voting period ended"
        );
        require(!proposal.executed, "Proposal already executed");

        // If user has voted before, remove previous vote
        if (hasVoted[_proposalId][sender]) {
            VoteType previousVote = votes[_proposalId][sender];
            if (previousVote == VoteType.FOR) {
                proposal.forVotes--;
            } else if (previousVote == VoteType.AGAINST) {
                proposal.againstVotes--;
            } else if (previousVote == VoteType.ABSTAIN) {
                proposal.abstainVotes--;
            }
        }

        // Record new vote
        votes[_proposalId][sender] = _voteType;
        hasVoted[_proposalId][sender] = true;

        if (_voteType == VoteType.FOR) {
            proposal.forVotes++;
        } else if (_voteType == VoteType.AGAINST) {
            proposal.againstVotes++;
        } else if (_voteType == VoteType.ABSTAIN) {
            proposal.abstainVotes++;
        }

        emit Voted(_proposalId, sender, _voteType);
    }

    /**
     * @dev Execute an approved proposal
     * Can be called by anyone after voting deadline and execution delay
     */
    function executeProposal(uint256 _proposalId) external {
        require(
            _proposalId > 0 && _proposalId <= proposalCount,
            "Invalid proposal ID"
        );

        Proposal storage proposal = proposals[_proposalId];
        require(!proposal.executed, "Proposal already executed");
        require(
            block.timestamp >= proposal.votingDeadline,
            "Voting period not ended"
        );
        require(
            block.timestamp >= proposal.executionDelay,
            "Execution delay not passed"
        );
        require(
            proposal.forVotes > proposal.againstVotes,
            "Proposal not approved"
        );
        require(totalDeposited >= proposal.amount, "Insufficient DAO balance");

        proposal.executed = true;
        totalDeposited -= proposal.amount; // Reduce total when funds are transferred out

        (bool success, ) = proposal.recipient.call{value: proposal.amount}("");
        require(success, "Transfer failed");

        emit ProposalExecuted(_proposalId, proposal.recipient, proposal.amount);
    }

    /**
     * @dev Get proposal details
     */
    function getProposal(
        uint256 _proposalId
    ) external view returns (Proposal memory) {
        require(
            _proposalId > 0 && _proposalId <= proposalCount,
            "Invalid proposal ID"
        );
        return proposals[_proposalId];
    }

    /**
     * @dev Get user's vote on a proposal
     */
    function getUserVote(
        uint256 _proposalId,
        address _user
    ) external view returns (VoteType) {
        return votes[_proposalId][_user];
    }

    /**
     * @dev Check if proposal can be executed
     */
    function canExecute(uint256 _proposalId) external view returns (bool) {
        if (_proposalId == 0 || _proposalId > proposalCount) return false;

        Proposal memory proposal = proposals[_proposalId];
        return
            !proposal.executed &&
            block.timestamp >= proposal.votingDeadline &&
            block.timestamp >= proposal.executionDelay &&
            proposal.forVotes > proposal.againstVotes &&
            totalDeposited >= proposal.amount;
    }

    /**
     * @dev Get total deposited balance in the DAO
     */
    function getBalance() external view returns (uint256) {
        return totalDeposited;
    }

    /**
     * @dev Get actual ETH balance of the contract
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @dev Get user's balance in the DAO
     */
    function getUserBalance(address _user) external view returns (uint256) {
        return balances[_user];
    }

    /**
     * @dev Get total deposited amount
     */
    function getTotalDeposited() external view returns (uint256) {
        return totalDeposited;
    }

    /**
     * @dev Override _msgSender to support ERC2771
     */
    function _msgSender()
        internal
        view
        virtual
        override(ERC2771Context)
        returns (address)
    {
        return ERC2771Context._msgSender();
    }

    /**
     * @dev Override _msgData to support ERC2771
     */
    function _msgData()
        internal
        view
        virtual
        override(ERC2771Context)
        returns (bytes calldata)
    {
        return ERC2771Context._msgData();
    }

    /**
     * @dev Override _contextSuffixLength to support ERC2771
     */
    function _contextSuffixLength()
        internal
        view
        virtual
        override(ERC2771Context)
        returns (uint256)
    {
        return ERC2771Context._contextSuffixLength();
    }
}
