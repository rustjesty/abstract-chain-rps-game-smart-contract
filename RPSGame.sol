// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title Rock Paper Scissors Game
 * @author Soljesty
 * @notice A decentralized Rock, Paper, Scissors game with cryptographic commitment scheme
 * @dev This contract implements a fair RPS game where players commit their moves before revealing them
 *      to prevent cheating and front-running attacks.
 */
contract RPSGame {
    // ============ ENUMS ============
    
    /// @notice Possible moves in the game
    enum Move { 
        None,       // 0 - Invalid move
        Rock,       // 1 - Rock beats Scissors
        Paper,      // 2 - Paper beats Rock  
        Scissors    // 3 - Scissors beats Paper
    }
    
    /// @notice Game states to ensure proper flow
    enum GameState { 
        Waiting,    // 0 - Waiting for second player to join
        Committed,  // 1 - Both players joined, waiting for move commitments
        Revealed,   // 2 - Both moves committed, waiting for revelations
        Finished    // 3 - Game completed, winner determined
    }
    
    // ============ STRUCTS ============
    
    /// @notice Game data structure
    /// @param player1 Address of the first player (game creator)
    /// @param player2 Address of the second player (joiner)
    /// @param player1Commitment Hash commitment of player1's move
    /// @param player2Commitment Hash commitment of player2's move
    /// @param player1Move Revealed move of player1 (0 if not revealed)
    /// @param player2Move Revealed move of player2 (0 if not revealed)
    /// @param state Current state of the game
    /// @param betAmount Amount each player bet (in wei)
    /// @param deadline Timestamp when game times out
    /// @param player1Revealed Whether player1 has revealed their move
    /// @param player2Revealed Whether player2 has revealed their move
    struct Game {
        address player1;
        address player2;
        bytes32 player1Commitment;
        bytes32 player2Commitment;
        Move player1Move;
        Move player2Move;
        GameState state;
        uint256 betAmount;
        uint256 deadline;
        bool player1Revealed;
        bool player2Revealed;
    }
    
    // ============ STATE VARIABLES ============
    
    /// @notice Mapping from game ID to game data
    mapping(uint256 => Game) public games;
    
    /// @notice Mapping from player address to array of their game IDs
    mapping(address => uint256[]) public playerGames;
    
    /// @notice Total number of games created (used as game ID counter)
    uint256 public gameCounter;
    
    /// @notice Minimum bet amount allowed (0.001 ETH)
    uint256 public minBet = 0.001 ether;
    
    /// @notice Maximum bet amount allowed (1 ETH)
    uint256 public maxBet = 1 ether;
    
    /// @notice Timeout duration for games (1 hour)
    uint256 public gameTimeout = 1 hours;
    
    /// @notice Contract owner for admin functions
    address public immutable owner;
    
    // ============ EVENTS ============
    
    /// @notice Emitted when a new game is created
    /// @param gameId Unique identifier for the game
    /// @param player1 Address of the game creator
    /// @param betAmount Amount bet by each player
    event GameCreated(uint256 indexed gameId, address indexed player1, uint256 betAmount);
    
    /// @notice Emitted when a second player joins a game
    /// @param gameId Unique identifier for the game
    /// @param player2 Address of the second player
    event PlayerJoined(uint256 indexed gameId, address indexed player2);
    
    /// @notice Emitted when a player commits their move
    /// @param gameId Unique identifier for the game
    /// @param player Address of the player who committed
    /// @param commitment Hash commitment of the move
    event MoveCommitted(uint256 indexed gameId, address indexed player, bytes32 commitment);
    
    /// @notice Emitted when a player reveals their move
    /// @param gameId Unique identifier for the game
    /// @param player Address of the player who revealed
    /// @param move The revealed move
    /// @param nonce Random nonce used in commitment
    event MoveRevealed(uint256 indexed gameId, address indexed player, Move move, bytes32 nonce);
    
    /// @notice Emitted when a game finishes and winner is determined
    /// @param gameId Unique identifier for the game
    /// @param winner Address of the winner (address(0) for tie)
    /// @param amount Amount won (0 for tie)
    event GameFinished(uint256 indexed gameId, address winner, uint256 amount);
    
    /// @notice Emitted when a game times out
    /// @param gameId Unique identifier for the game
    event GameTimeout(uint256 indexed gameId);
    
    /// @notice Emitted when admin settings are updated
    /// @param setting Name of the setting changed
    /// @param oldValue Previous value
    /// @param newValue New value
    event SettingUpdated(string setting, uint256 oldValue, uint256 newValue);
    
    // ============ MODIFIERS ============
    
    /// @notice Restricts function access to game participants only
    /// @param gameId ID of the game
    modifier onlyGamePlayer(uint256 gameId) {
        Game storage game = games[gameId];
        require(
            game.player1 == msg.sender || game.player2 == msg.sender,
            "RPS: Only game players can call this function"
        );
        _;
    }
    
    /// @notice Ensures the game exists
    /// @param gameId ID of the game
    modifier gameExists(uint256 gameId) {
        require(gameId < gameCounter, "RPS: Game does not exist");
        _;
    }
    
    /// @notice Ensures the game is not finished
    /// @param gameId ID of the game
    modifier gameNotFinished(uint256 gameId) {
        require(games[gameId].state != GameState.Finished, "RPS: Game is already finished");
        _;
    }
    
    /// @notice Restricts function access to contract owner only
    modifier onlyOwner() {
        require(msg.sender == owner, "RPS: Only owner can call this function");
        _;
    }
    
    /// @notice Ensures the game has not timed out
    /// @param gameId ID of the game
    modifier gameNotTimedOut(uint256 gameId) {
        require(block.timestamp < games[gameId].deadline, "RPS: Game has timed out");
        _;
    }
    
    // ============ CONSTRUCTOR ============
    
    /// @notice Initializes the contract
    constructor() {
        owner = msg.sender;
    }
    
    // ============ EXTERNAL FUNCTIONS ============
    
    /**
     * @notice Creates a new RPS game
     * @dev Player 1 creates the game and sets the bet amount
     * @dev Emits GameCreated event
     */
    function createGame() external payable {
        require(msg.value >= minBet && msg.value <= maxBet, "RPS: Invalid bet amount");
        require(msg.value > 0, "RPS: Bet amount must be greater than 0");
        
        uint256 gameId = gameCounter++;
        
        games[gameId] = Game({
            player1: msg.sender,
            player2: address(0),
            player1Commitment: bytes32(0),
            player2Commitment: bytes32(0),
            player1Move: Move.None,
            player2Move: Move.None,
            state: GameState.Waiting,
            betAmount: msg.value,
            deadline: block.timestamp + gameTimeout,
            player1Revealed: false,
            player2Revealed: false
        });
        
        playerGames[msg.sender].push(gameId);
        
        emit GameCreated(gameId, msg.sender, msg.value);
    }
    
    /**
     * @notice Allows a second player to join an existing game
     * @param gameId ID of the game to join
     * @dev Player 2 must send exactly the same bet amount as player 1
     * @dev Emits PlayerJoined event
     */
    function joinGame(uint256 gameId) 
        external 
        payable 
        gameExists(gameId) 
        gameNotFinished(gameId) 
        gameNotTimedOut(gameId) 
    {
        Game storage game = games[gameId];
        
        require(game.state == GameState.Waiting, "RPS: Game is not waiting for player");
        require(game.player2 == address(0), "RPS: Game already has two players");
        require(msg.sender != game.player1, "RPS: Cannot join your own game");
        require(msg.value == game.betAmount, "RPS: Bet amount must match");
        
        game.player2 = msg.sender;
        game.state = GameState.Committed;
        
        playerGames[msg.sender].push(gameId);
        
        emit PlayerJoined(gameId, msg.sender);
    }
    
    /**
     * @notice Commits a player's move using a cryptographic hash
     * @param gameId ID of the game
     * @param commitment Hash of (move + nonce + player address)
     * @dev Players must commit their moves before revealing them to prevent cheating
     * @dev Emits MoveCommitted event
     */
    function commitMove(uint256 gameId, bytes32 commitment) 
        external 
        onlyGamePlayer(gameId) 
        gameExists(gameId) 
        gameNotFinished(gameId) 
        gameNotTimedOut(gameId) 
    {
        Game storage game = games[gameId];
        require(game.state == GameState.Committed, "RPS: Game is not in committed state");
        
        if (msg.sender == game.player1) {
            require(game.player1Commitment == bytes32(0), "RPS: Player 1 already committed");
            game.player1Commitment = commitment;
        } else {
            require(game.player2Commitment == bytes32(0), "RPS: Player 2 already committed");
            game.player2Commitment = commitment;
        }
        
        emit MoveCommitted(gameId, msg.sender, commitment);
        
        // Check if both players have committed
        if (game.player1Commitment != bytes32(0) && game.player2Commitment != bytes32(0)) {
            game.state = GameState.Revealed;
        }
    }
    
    /**
     * @notice Reveals a player's move with the original nonce
     * @param gameId ID of the game
     * @param move The move to reveal (1=Rock, 2=Paper, 3=Scissors)
     * @param nonce The random nonce used in the commitment
     * @dev The commitment must match keccak256(abi.encodePacked(move, nonce, msg.sender))
     * @dev Emits MoveRevealed event
     */
    function revealMove(uint256 gameId, Move move, bytes32 nonce) 
        external 
        onlyGamePlayer(gameId) 
        gameExists(gameId) 
        gameNotFinished(gameId) 
        gameNotTimedOut(gameId) 
    {
        Game storage game = games[gameId];
        require(game.state == GameState.Revealed, "RPS: Game is not in revealed state");
        require(move != Move.None, "RPS: Invalid move");
        
        bytes32 commitment = keccak256(abi.encodePacked(move, nonce, msg.sender));
        
        if (msg.sender == game.player1) {
            require(game.player1Commitment == commitment, "RPS: Invalid commitment for player 1");
            require(!game.player1Revealed, "RPS: Player 1 already revealed");
            game.player1Move = move;
            game.player1Revealed = true;
        } else {
            require(game.player2Commitment == commitment, "RPS: Invalid commitment for player 2");
            require(!game.player2Revealed, "RPS: Player 2 already revealed");
            game.player2Move = move;
            game.player2Revealed = true;
        }
        
        emit MoveRevealed(gameId, msg.sender, move, nonce);
        
        // Check if both players have revealed
        if (game.player1Revealed && game.player2Revealed) {
            _determineWinner(gameId);
        }
    }
    
    /**
     * @notice Times out a game and returns funds to players
     * @param gameId ID of the game to timeout
     * @dev Anyone can call this function after the deadline
     * @dev Emits GameTimeout event
     */
    function timeoutGame(uint256 gameId) 
        external 
        gameExists(gameId) 
        gameNotFinished(gameId) 
    {
        Game storage game = games[gameId];
        require(block.timestamp >= game.deadline, "RPS: Game has not timed out yet");
        
        game.state = GameState.Finished;
        
        // Return funds to players
        if (game.player1 != address(0)) {
            (bool success1, ) = payable(game.player1).call{value: game.betAmount}("");
            require(success1, "RPS: Failed to transfer funds to player 1");
        }
        if (game.player2 != address(0)) {
            (bool success2, ) = payable(game.player2).call{value: game.betAmount}("");
            require(success2, "RPS: Failed to transfer funds to player 2");
        }
        
        emit GameTimeout(gameId);
    }
    
    // ============ INTERNAL FUNCTIONS ============
    
    /**
     * @notice Determines the winner and distributes funds
     * @param gameId ID of the game
     * @dev Internal function called when both players have revealed their moves
     * @dev Emits GameFinished event
     */
    function _determineWinner(uint256 gameId) internal {
        Game storage game = games[gameId];
        game.state = GameState.Finished;
        
        address winner;
        uint256 amount = game.betAmount * 2;
        
        if (game.player1Move == game.player2Move) {
            // Tie - split the pot
            (bool success1, ) = payable(game.player1).call{value: game.betAmount}("");
            require(success1, "RPS: Failed to transfer funds to player 1");
            
            (bool success2, ) = payable(game.player2).call{value: game.betAmount}("");
            require(success2, "RPS: Failed to transfer funds to player 2");
            
            winner = address(0);
            amount = 0;
        } else if (
            (game.player1Move == Move.Rock && game.player2Move == Move.Scissors) ||
            (game.player1Move == Move.Paper && game.player2Move == Move.Rock) ||
            (game.player1Move == Move.Scissors && game.player2Move == Move.Paper)
        ) {
            // Player 1 wins
            (bool success, ) = payable(game.player1).call{value: amount}("");
            require(success, "RPS: Failed to transfer funds to winner");
            winner = game.player1;
        } else {
            // Player 2 wins
            (bool success, ) = payable(game.player2).call{value: amount}("");
            require(success, "RPS: Failed to transfer funds to winner");
            winner = game.player2;
        }
        
        emit GameFinished(gameId, winner, amount);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @notice Gets the complete game data
     * @param gameId ID of the game
     * @return Complete game data structure
     */
    function getGame(uint256 gameId) external view returns (Game memory) {
        return games[gameId];
    }
    
    /**
     * @notice Gets all game IDs for a specific player
     * @param player Address of the player
     * @return Array of game IDs
     */
    function getPlayerGames(address player) external view returns (uint256[] memory) {
        return playerGames[player];
    }
    
    /**
     * @notice Gets all available games (waiting for second player)
     * @return Array of game IDs that are available to join
     */
    function getAvailableGames() external view returns (uint256[] memory) {
        uint256[] memory available = new uint256[](gameCounter);
        uint256 count = 0;
        
        for (uint256 i = 0; i < gameCounter; i++) {
            if (games[i].state == GameState.Waiting && games[i].player2 == address(0)) {
                available[count] = i;
                count++;
            }
        }
        
        // Resize array to actual count
        assembly {
            mstore(available, count)
        }
        
        return available;
    }
    
    /**
     * @notice Gets the number of games for a player
     * @param player Address of the player
     * @return Number of games
     */
    function getPlayerGameCount(address player) external view returns (uint256) {
        return playerGames[player].length;
    }
    
    /**
     * @notice Gets the number of available games
     * @return Number of games waiting for players
     */
    function getAvailableGameCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < gameCounter; i++) {
            if (games[i].state == GameState.Waiting && games[i].player2 == address(0)) {
                count++;
            }
        }
        return count;
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @notice Sets the minimum bet amount (owner only)
     * @param _minBet New minimum bet amount in wei
     * @dev Emits SettingUpdated event
     */
    function setMinBet(uint256 _minBet) external onlyOwner {
        require(_minBet < maxBet, "RPS: Min bet must be less than max bet");
        require(_minBet > 0, "RPS: Min bet must be greater than 0");
        
        uint256 oldValue = minBet;
        minBet = _minBet;
        
        emit SettingUpdated("minBet", oldValue, _minBet);
    }
    
    /**
     * @notice Sets the maximum bet amount (owner only)
     * @param _maxBet New maximum bet amount in wei
     * @dev Emits SettingUpdated event
     */
    function setMaxBet(uint256 _maxBet) external onlyOwner {
        require(_maxBet > minBet, "RPS: Max bet must be greater than min bet");
        
        uint256 oldValue = maxBet;
        maxBet = _maxBet;
        
        emit SettingUpdated("maxBet", oldValue, _maxBet);
    }
    
    /**
     * @notice Sets the game timeout duration (owner only)
     * @param _timeout New timeout duration in seconds
     * @dev Emits SettingUpdated event
     */
    function setGameTimeout(uint256 _timeout) external onlyOwner {
        require(_timeout > 0, "RPS: Timeout must be greater than 0");
        require(_timeout <= 24 hours, "RPS: Timeout cannot exceed 24 hours");
        
        uint256 oldValue = gameTimeout;
        gameTimeout = _timeout;
        
        emit SettingUpdated("gameTimeout", oldValue, _timeout);
    }
    
    // ============ EMERGENCY FUNCTIONS ============
    
    /**
     * @notice Emergency function to withdraw stuck funds (owner only)
     * @dev Only callable by owner in emergency situations
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "RPS: No funds to withdraw");
        
        (bool success, ) = payable(owner).call{value: balance}("");
        require(success, "RPS: Failed to withdraw funds");
    }
    
    // ============ RECEIVE FUNCTION ============
    
    /**
     * @notice Allows the contract to receive ETH
     * @dev This function is required for the contract to receive ETH
     */
    receive() external payable {
        // Contract can receive ETH (for refunds, etc.)
    }
}
