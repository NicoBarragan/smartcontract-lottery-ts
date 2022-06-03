// Raffle
// Enter the lottery (w amount)
// Winner to be selected every X minutes -> automated
// Chainlink oracle -> Randomness, automated exec (Keepers)

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";

error Raffle__NotEnoughETHEntered();
error Raffle__TransferFailed();
error Raffle__NotOpen();
error Raffle__UpkeepNotNeeded(
    uint256 currentBalance,
    uint256 numPlayers,
    uint256 raffleState
);

/** @title A Raffle Contract
 *  @author Nicolas Barragan
 *  @notice This contract is for creating an untamperable descentralized smart contract
 *  @dev This implements Chainlink VRF v2 and Chainlink Keepers
 */

contract Raffle is VRFConsumerBaseV2, KeeperCompatibleInterface {
    /* Type declarations */
    enum RaffleState {
        OPEN,
        CALCULATING
    }

    /* State Variables */
    uint256 private immutable _entranceFee; // immutable is when is constant but received in constructor
    address payable[] private _players; // If a player wins, we'll have to pay them, so is address and payable[]
    VRFCoordinatorV2Interface private immutable _vrfCoordinator;
    bytes32 private immutable _keyHash; // gasLane: Max gas price you're willing to pay in wei for a request (in VRF V2)
    uint64 private immutable _subscriptionId; // id of the VRF V2 sub
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private immutable _callbackGasLimit; // Max gas price you're willing to pay in wei in the VRF V2 callback (fullFillRandomness, the 2nd tx)
    uint32 private constant NUM_NUMBERS = 1; // Number of nums that VRF is gonna return
    RaffleState private _raffleState;
    uint256 private _lastTimestamp;
    uint256 private immutable _interval;

    /* Lottery variables */
    address payable private _recentWinner;

    /* Functions */
    constructor(
        uint256 entranceFee,
        address vrfCoordinatorV2,
        bytes32 keyHash,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        uint256 interval
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        _entranceFee = entranceFee;
        _vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        _keyHash = keyHash;
        _subscriptionId = subscriptionId;
        _callbackGasLimit = callbackGasLimit;
        _raffleState = RaffleState.OPEN;
        _lastTimestamp = block.timestamp;
        _interval = interval;
    }

    event RaffleEnter(address indexed player);
    event RequestedRaffleWinner(uint256 indexed requestId);
    event winnerPicked(address indexed winner);

    function enterRaffle() public payable {
        // require(msg.value > _entranceFee, "Not enough ETH!"); --> Saving the revert msg in the require uses more gas than an error, because of that instead of storing a string we'll store an error code for our SC.
        if (msg.value < _entranceFee) {
            revert Raffle__NotEnoughETHEntered();
        }
        if (_raffleState != RaffleState.OPEN) {
            revert Raffle__NotOpen();
        }
        _players.push(payable(msg.sender));
        // Emit an event when we update a dynamic array or mapping
        // Named events with the function name reversed
        emit RaffleEnter(msg.sender);
    }

    /**
     * @dev This is the funciton that the Chainlink Keeper nodes call
     * they look for the 'upkeepNeeded' to return true. The requirements are:
     * 1. Our time interval should have passed
     * 2. The lottery should have at least 1 player, and have some ETH
     * 3. Our subscription is funded with link
     * 4. The lottery should be on 'open' state
     */

    function checkUpkeep(
        // calldata type param doesn't able to pass empty strings, memory yes
        bytes memory /* checkData */ // bytes as param type means we can pass whatever, including a call to another function
    )
        public
        override
        returns (
            bool upkeepNeeded,
            bytes memory /* performData */ // perform data is for if we need to do some other staff
        )
    {
        bool isOpen = (_raffleState == RaffleState.OPEN);
        bool timePassed = ((block.timestamp - _lastTimestamp) > _interval);
        bool hasPlayers = (_players.length > 0);
        bool hasBalance = address(this).balance > 0;
        // bool hasLink = _vrfCoordinator.isSubscriptionFunded(_subscriptionId);

        upkeepNeeded = (isOpen && timePassed && hasPlayers && hasBalance); // && hasLink);
        // we don't need to define upkeepNeeded since is defined in the 'returns' of the function
        // and is not necessary use 'return' here because we defined in the 'returns' too
    }

    function performUpkeep(
        bytes calldata /* performData */
    ) external override {
        // Request random number
        // Once we get it, do smthing with it
        // 2 tx process (for more security, for avoid simulating the call in 1 tx and manipulate the random number, avoiding the numbers that not make the caller winner)
        (bool upkeepNeeded, ) = checkUpkeep("");
        if (!upkeepNeeded) {
            revert Raffle__UpkeepNotNeeded(
                address(this).balance,
                _players.length,
                uint256(_raffleState)
            );
        }
        _raffleState = RaffleState.CALCULATING;
        uint256 requestId = _vrfCoordinator.requestRandomWords(
            _keyHash,
            _subscriptionId,
            REQUEST_CONFIRMATIONS,
            _callbackGasLimit,
            NUM_NUMBERS
        );
        emit RequestedRaffleWinner(requestId);
    }

    // Words refers to numbers, but is a computational convention
    function fulfillRandomWords(
        uint256, /* requestId */ // This is for saying, we know that you need that param, but we don't need
        uint256[] memory randomNumbers
    ) internal override {
        // % --> For make the received number be in the players length. eg:
        // num = 202 - arr length = 10. 202 % 2 == 2. 2 is in the arr of then idx
        uint256 winnerIndex = randomNumbers[0] % _players.length;
        address payable recentWinner = _players[winnerIndex];
        _recentWinner = recentWinner;
        _raffleState = RaffleState.OPEN;
        _players = new address payable[](0); // a new arr for players
        _lastTimestamp = block.timestamp; // reset _lastTimestamp
        (bool success, ) = recentWinner.call{value: address(this).balance}("");
        if (!success) {
            revert Raffle__TransferFailed();
        }
        emit winnerPicked(recentWinner);
    }

    /* View / Pure functions */

    function getEntranceFee() private view returns (uint256) {
        return _entranceFee;
    }

    function getPlayer(uint256 _index) private view returns (address) {
        return _players[_index];
    }

    function getRecentWinner() private view returns (address) {
        return _recentWinner;
    }

    function getRaffleState() public view returns (RaffleState) {
        return _raffleState;
    }

    function getNumNumbers() public pure returns (uint256) {
        return NUM_NUMBERS;
        // this constant is in the bytecode, so it isn't reading from storage and the function is pure and not view
    }

    function getNumberOfPlayers() public view returns (uint256) {
        return _players.length;
    }

    function getLatestTimestamp() public view returns (uint256) {
        return _lastTimestamp;
    }

    function getRequestConfirmations() public pure returns (uint256) {
        return REQUEST_CONFIRMATIONS; // the same as getNumNumbers()
    }

    function getInterval() public view returns (uint256) {
        return _interval; // the same as getNumNumbers()
    }
}
