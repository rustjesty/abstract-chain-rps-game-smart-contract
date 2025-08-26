// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract RPSGame {
    enum Move { None, Rock, Paper, Scissors }
    enum GameState { Waiting, Committed, Revealed, Finished }
    
    struct Game {
        address player1;
        address player2;
        bytes32 player1Commitment;
        Move player1Move;
        Move player2Move;
        GameState state;
        uint256 betAmount;
        uint256 deadline;
        bool player1Revealed;
        bool player2Revealed;
    }
    
    mapping(uint256 => Game) public games;
    mapping(address => uint256[]) public playerGames;
    
    uint256 public gameCounter;
    uint256 public minBet = 0.001 ether;
    uint256 public maxBet = 1 ether;
    uint256 public gameTimeout = 1 hours;
    
    event GameCreated(uint256 indexed gameId, address indexed player1, uint256 betAmount);
    event PlayerJoined(uint256 indexed gameId, address indexed player2);
    event MoveCommitted(uint256 indexed gameId, address indexed player, bytes32 commitment);
    event MoveRevealed(uint256 indexed gameId, address indexed player, Move move, bytes32 nonce);
    event GameFinished(uint256 indexed gameId, address winner, uint256 amount);
    event GameTimeout(uint256 indexed gameId);
    
    modifier onlyGamePlayer(uint256 gameId) {
        require(
            games[gameId].player1 == msg.sender || games[gameId].player2 == msg.sender,
            "Only game players can call this function"
        );
        _;
    }
    
    modifier gameExists(uint256 gameId) {
        require(gameId < gameCounter, "Game does not exist");
        _;
    }
    
    modifier gameNotFinished(uint256 gameId) {
        require(games[gameId].state != GameState.Finished, "Game is already finished");
        _;
    }
    
    function createGame() external payable {
        require(msg.value >= minBet && msg.value <= maxBet, "Invalid bet amount");
        require(msg.value > 0, "Bet amount must be greater than 0");
        
        uint256 gameId = gameCounter++;
        games[gameId] = Game({
            player1: msg.sender,
            player2: address(0),
            player1Commitment: bytes32(0),
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
    
    function joinGame(uint256 gameId) external payable gameExists(gameId) {
        Game storage game = games[gameId];
        require(game.state == GameState.Waiting, "Game is not waiting for player");
        require(game.player2 == address(0), "Game already has two players");
        require(msg.sender != game.player1, "Cannot join your own game");
        require(msg.value == game.betAmount, "Bet amount must match");
        require(block.timestamp < game.deadline, "Game has timed out");
        
        game.player2 = msg.sender;
        game.state = GameState.Committed;
        
        playerGames[msg.sender].push(gameId);
        
        emit PlayerJoined(gameId, msg.sender);
    }
    
    function commitMove(uint256 gameId, bytes32 commitment) external 
        onlyGamePlayer(gameId) 
        gameExists(gameId) 
        gameNotFinished(gameId) 
    {
        Game storage game = games[gameId];
        require(game.state == GameState.Committed, "Game is not in committed state");
        require(block.timestamp < game.deadline, "Game has timed out");
        
        if (msg.sender == game.player1) {
            require(game.player1Commitment == bytes32(0), "Player 1 already committed");
            game.player1Commitment = commitment;
        } else {
            require(game.player2Commitment == bytes32(0), "Player 2 already committed");
            game.player2Commitment = commitment;
        }
        
        emit MoveCommitted(gameId, msg.sender, commitment);
        
        // Check if both players have committed
        if (game.player1Commitment != bytes32(0) && game.player2Commitment != bytes32(0)) {
            game.state = GameState.Revealed;
        }
    }
    
    function revealMove(uint256 gameId, Move move, bytes32 nonce) external 
        onlyGamePlayer(gameId) 
        gameExists(gameId) 
        gameNotFinished(gameId) 
    {
        Game storage game = games[gameId];
        require(game.state == GameState.Revealed, "Game is not in revealed state");
        require(move != Move.None, "Invalid move");
        require(block.timestamp < game.deadline, "Game has timed out");
        
        bytes32 commitment = keccak256(abi.encodePacked(move, nonce, msg.sender));
        
        if (msg.sender == game.player1) {
            require(game.player1Commitment == commitment, "Invalid commitment");
            require(!game.player1Revealed, "Player 1 already revealed");
            game.player1Move = move;
            game.player1Revealed = true;
        } else {
            require(game.player2Commitment == commitment, "Invalid commitment");
            require(!game.player2Revealed, "Player 2 already revealed");
            game.player2Move = move;
            game.player2Revealed = true;
        }
        
        emit MoveRevealed(gameId, msg.sender, move, nonce);
        
        // Check if both players have revealed
        if (game.player1Revealed && game.player2Revealed) {
            _determineWinner(gameId);
        }
    }
    
    function timeoutGame(uint256 gameId) external gameExists(gameId) gameNotFinished(gameId) {
        Game storage game = games[gameId];
        require(block.timestamp >= game.deadline, "Game has not timed out yet");
        
        game.state = GameState.Finished;
        
        // Return funds to players
        if (game.player1 != address(0)) {
            payable(game.player1).transfer(game.betAmount);
        }
        if (game.player2 != address(0)) {
            payable(game.player2).transfer(game.betAmount);
        }
        
        emit GameTimeout(gameId);
    }
    
    function _determineWinner(uint256 gameId) internal {
        Game storage game = games[gameId];
        game.state = GameState.Finished;
        
        address winner;
        uint256 amount = game.betAmount * 2;
        
        if (game.player1Move == game.player2Move) {
            // Tie - split the pot
            payable(game.player1).transfer(game.betAmount);
            payable(game.player2).transfer(game.betAmount);
            winner = address(0);
        } else if (
            (game.player1Move == Move.Rock && game.player2Move == Move.Scissors) ||
            (game.player1Move == Move.Paper && game.player2Move == Move.Rock) ||
            (game.player1Move == Move.Scissors && game.player2Move == Move.Paper)
        ) {
            // Player 1 wins
            payable(game.player1).transfer(amount);
            winner = game.player1;
        } else {
            // Player 2 wins
            payable(game.player2).transfer(amount);
            winner = game.player2;
        }
        
        emit GameFinished(gameId, winner, amount);
    }
    
    // View functions
    function getGame(uint256 gameId) external view returns (Game memory) {
        return games[gameId];
    }
    
    function getPlayerGames(address player) external view returns (uint256[] memory) {
        return playerGames[player];
    }
    
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
    
    // Admin functions
    function setMinBet(uint256 _minBet) external {
        // In a real contract, this would be restricted to owner
        minBet = _minBet;
    }
    
    function setMaxBet(uint256 _maxBet) external {
        // In a real contract, this would be restricted to owner
        maxBet = _maxBet;
    }
    
    function setGameTimeout(uint256 _timeout) external {
        // In a real contract, this would be restricted to owner
        gameTimeout = _timeout;
    }
}
