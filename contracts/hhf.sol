pragma solidity ^0.4.18;

contract owned {
    
    address public owner;

    function owned() public {
        owner = msg.sender;
    }

    modifier onlyOwner {
        require(msg.sender == owner);
        _;
    }

    function transferOwnership(address newOwner) onlyOwner public {
        owner = newOwner;
    }
    
}

contract tokenRecipient {
    
    event receivedEther(address sender, uint amount);
    event receivedTokens(address _from, uint256 _value, address _token, bytes _extraData);

    function receiveApproval(address _from, uint256 _value, address _token, bytes _extraData)
    public {
        Token t = Token(_token);
        require(t.transferFrom(_from, this, _value));
        receivedTokens(_from, _value, _token, _extraData);
    }

    function () payable public {
        receivedEther(msg.sender, msg.value);
    }
    
}

contract Token {
    mapping (address => uint256) public balanceOf;
    function transferFrom(address _from, address _to, uint256 _value) public returns (bool success);
}

/**
 * The shareholder association contract itself
 */
contract HHF is owned, tokenRecipient {

    Token public sharesTokenAddress;
    
    address public Symbol;
    
    uint public minimumParticipants;
    uint public moneyQuorumPercentage;
    uint public peopleQuorumPercentage;
    
    uint public debatingPeriodInMinutes;
    Proposal[] public proposals;
    uint public numProposals;

    event ProposalAdded(uint proposalID, address recipient, uint amount, string description, uint votingDeadline);
    event Voted(uint proposalID, bool position, address voter);
    event PeopleTallied(uint proposalID, uint peopleresult, uint peoplequorum, bool peoplesupport);
    event MoneyTallied(uint proposalID, uint moneyresult, uint moneyquorum, bool moneysupport);
    event SymbolTallied(uint proposalID, bool symbolsupport);
    event ProposalTallied(uint proposalID, bool symbolsupport, bool moneysupport, bool peoplesupport, bool passed);
    event ChangeOfRules(uint newMinimumParticipants, uint newMoneyQuorumPercentage, uint newPeopleQuorumPercentage, uint newDebatingPeriodInMinutes, address newSharesTokenAddress);

    struct Proposal {
        address recipient;
        uint amount;
        string description;
        uint votingDeadline;
        bool executed;
        bool proposalPassed;
        uint numberOfVotes;
        bytes32 proposalHash;
        uint daysToExecute;
        Vote[] votes;
        mapping (address => bool) voted;
    }

    struct Vote {
        bool inSupport;
        address voter;
    }

    // Modifier that allows only shareholders to vote and create new proposals
    modifier onlyShareholders {
        require(sharesTokenAddress.balanceOf(msg.sender) > 10000);
        _;
    }

    /**
     * Constructor function
     * First time setup
     */
    function HHF(Token sharesAddress, uint startingMinimumParticipants, uint startingMoneyQuorumPercentage, uint startingPeopleQuorumPercentage, uint minutesForDebate) 
    public payable {
        ownerChangeVotingRules(sharesAddress, startingMinimumParticipants, startingMoneyQuorumPercentage, startingPeopleQuorumPercentage, minutesForDebate);
        Symbol = owner;
    }

    /**
     * Change voting rules
     * Make so that proposals need to be discussed for at least `minutesForDebate/60` hours
     * and all voters combined must total more than 'minimumParticipants'
     * @param sharesAddress token address
     * @param newMinimumParticipants proposal can vote only if the sum of all voters exceed this number
     * @param newMinutesForDebate the minimum amount of delay between when a proposal is made and when it can be executed
     */
    function ownerChangeVotingRules(Token sharesAddress, uint newMinimumParticipants, uint newMoneyQuorumPercentage, uint newPeopleQuorumPercentage, uint newMinutesForDebate) onlyOwner 
    public {
        if (newMinimumParticipants == 0 ) newMinimumParticipants = 1;
        if (newMoneyQuorumPercentage == 0 ) newMoneyQuorumPercentage = 1;
        if (newPeopleQuorumPercentage == 0 ) newPeopleQuorumPercentage = 1;
        sharesTokenAddress = Token(sharesAddress);
        minimumParticipants = newMinimumParticipants;
        moneyQuorumPercentage = newMoneyQuorumPercentage;
        peopleQuorumPercentage = newPeopleQuorumPercentage;
        debatingPeriodInMinutes = newMinutesForDebate;
        ChangeOfRules(minimumParticipants, moneyQuorumPercentage, peopleQuorumPercentage, debatingPeriodInMinutes, sharesTokenAddress);
    }
    
    /**
     * Change Symbol
     * Can only be done by the owner
     * @param newSymbolAddress Address of the new Symbol
     **/
    function ownerChangeSymbol(address newSymbolAddress) onlyOwner
    public {
        Symbol = newSymbolAddress;
    }

    /**
     * Add Proposal in Wei
     * Propose to send `weiAmount / 1e18` ether to `beneficiary` for `jobDescription`. `transactionBytecode ? Contains : Does not contain` code.
     * @param beneficiary who to send the ether to
     * @param weiAmount amount of ether to send, in wei
     * @param jobDescription Description of job
     * @param transactionBytecode bytecode of transaction
     */
    function newProposalInWei(address beneficiary, uint weiAmount, string jobDescription, uint daysToExecute, bytes transactionBytecode)
    public onlyShareholders returns (uint proposalID)
    {
        proposalID = proposals.length++;
        Proposal storage p = proposals[proposalID];
        p.recipient = beneficiary;
        p.amount = weiAmount;
        p.description = jobDescription;
        p.proposalHash = keccak256(beneficiary, weiAmount, transactionBytecode);
        p.votingDeadline = now + debatingPeriodInMinutes * 1 minutes;
        p.executed = false;
        p.proposalPassed = false;
        p.numberOfVotes = 0;
        p.daysToExecute = daysToExecute;
        ProposalAdded(proposalID, beneficiary, weiAmount, jobDescription, p.votingDeadline);
        numProposals = proposalID+1;
        return proposalID;
    }

    /**
     * Add proposal in Ether
     * Propose to send `etherAmount` ether to `beneficiary` for `jobDescription`. `transactionBytecode ? Contains : Does not contain` code.
     * This is a convenience function to use if the amount to be given is in round number of ether units.
     * @param beneficiary who to send the ether to
     * @param etherAmount amount of ether to send
     * @param jobDescription Description of job
     * @param transactionBytecode bytecode of transaction
     */
    function newProposalInEther(address beneficiary, uint etherAmount, string jobDescription, uint daysToExecute, bytes transactionBytecode)
    public onlyShareholders returns (uint proposalID)
    {
        return newProposalInWei(beneficiary, etherAmount * 1 ether, jobDescription, daysToExecute, transactionBytecode);
    }

    /**
     * Check if a proposal code matches
     * @param proposalNumber ID number of the proposal to query
     * @param beneficiary who to send the ether to
     * @param weiAmount amount of ether to send
     * @param transactionBytecode bytecode of transaction
     */
    function checkProposalCode(uint proposalNumber, address beneficiary, uint weiAmount, bytes transactionBytecode)
    public constant returns (bool codeChecksOut)
    {
        Proposal storage p = proposals[proposalNumber];
        return p.proposalHash == keccak256(beneficiary, weiAmount, transactionBytecode);
    }

    /**
     * Log a vote for a proposal
     * Vote `supportsProposal? in support of : against` proposal #`proposalNumber`
     * @param proposalNumber number of proposal
     * @param supportsProposal either in favor or against it
     */
    function vote(uint proposalNumber, bool supportsProposal) onlyShareholders public returns (uint voteID)
    {
        Proposal storage p = proposals[proposalNumber];
        require(p.voted[msg.sender] != true);
        voteID = p.votes.length++;
        p.votes[voteID] = Vote({inSupport: supportsProposal, voter: msg.sender});
        p.voted[msg.sender] = true;
        p.numberOfVotes = voteID +1;
        Voted(proposalNumber,  supportsProposal, msg.sender);
        return voteID;
    }

    /**
     * Finish vote
     * Count the votes proposal #`proposalNumber` and execute it if approved
     * @param proposalNumber proposal number
     * @param transactionBytecode optional: if the transaction contained a bytecode, you need to send it
     */
    function executeProposal(uint proposalNumber, bytes transactionBytecode) public {
        
        Proposal storage p = proposals[proposalNumber];
        
        
        require(now > p.votingDeadline                                             // If it is past the voting deadline
            && !p.executed                                                          // and it has not already been executed
            && now < p.votingDeadline + (1 days * p.daysToExecute)                                        // and it hasn't been 1 day past the deadline
            && p.proposalHash == keccak256(p.recipient, p.amount, transactionBytecode)); // and the supplied code matches the proposal...

        // Voting variables
        uint totalVotingMoney = 0;
        uint moneyYea = 0;
        
        uint totalVotingPeople = p.votes.length;
        uint peopleYea = 0;
        uint peopleQuorum = (totalVotingPeople*peopleQuorumPercentage)/100 + 1; // Number of votes needed for yes
        
        bool symbolSupport = false;
        
        // Tally the results
        for (uint i = 0; i <  p.votes.length; ++i) {
            // For each vote...
            Vote storage v = p.votes[i];
            // moneyWeight is the amount of tokens they hold
            uint moneyWeight = sharesTokenAddress.balanceOf(v.voter);
            if (v.inSupport) {
                moneyYea += moneyWeight;
                totalVotingMoney += moneyWeight;
                peopleYea++;
            } else {
                totalVotingMoney += moneyWeight;
            }
            if( v.voter == Symbol && v.inSupport) {
                symbolSupport = true;
            }
        }
        
        // Check that enough people voted and calculate moneyQuorum
        require(totalVotingPeople >= minimumParticipants);
        uint moneyQuorum = ((totalVotingMoney*moneyQuorumPercentage)/100 ) + 1;
        
        if (moneyYea >= moneyQuorum && peopleYea > peopleQuorum) {
            // Proposal passed without Symbol; execute the transaction
            p.executed = true;
            require(p.recipient.call.value(p.amount)(transactionBytecode));
            p.proposalPassed = true;
        } else if (moneyYea < moneyQuorum && peopleYea < peopleQuorum ) {
            // Proposal failed without Symbol
            p.proposalPassed = false;
        } else {
            // The fate of the proposal lies in the acting Symbol
            p.executed = symbolSupport;
            if (p.executed) {
                require(p.recipient.call.value(p.amount)(transactionBytecode));
            }
            p.proposalPassed = p.executed;
        }

        // Fire Events
        MoneyTallied(proposalNumber, moneyYea, moneyQuorum, moneyYea>moneyQuorum);
        SymbolTallied(proposalNumber, symbolSupport);
        PeopleTallied(proposalNumber, peopleYea, peopleQuorum, peopleYea>peopleQuorum);
        ProposalTallied(proposalNumber, symbolSupport, moneyYea>=moneyQuorum, peopleYea>=peopleQuorum, p.proposalPassed);

    }
    
}
