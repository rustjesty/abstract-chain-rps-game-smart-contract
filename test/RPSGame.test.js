const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * @title RPSGame Test Suite
 * @description Comprehensive tests for the Rock, Paper, Scissors smart contract
 */
describe("RPSGame", function () {
  let RPSGame;
  let rpsGame;
  let owner;
  let player1;
  let player2;
  let player3;
  let player4;

  // Test constants
  const MIN_BET = ethers.parseEther("0.001");
  const MAX_BET = ethers.parseEther("1");
  const DEFAULT_BET = ethers.parseEther("0.01");
  const GAME_TIMEOUT = 3600; // 1 hour

  beforeEach(async function () {
    [owner, player1, player2, player3, player4] = await ethers.getSigners();
    
    RPSGame = await ethers.getContractFactory("RPSGame");
    rpsGame = await RPSGame.deploy();
  });

  describe("Deployment", function () {
    it("Should set the correct initial values", async function () {
      expect(await rpsGame.minBet()).to.equal(MIN_BET);
      expect(await rpsGame.maxBet()).to.equal(MAX_BET);
      expect(await rpsGame.gameTimeout()).to.equal(GAME_TIMEOUT);
      expect(await rpsGame.gameCounter()).to.equal(0);
      expect(await rpsGame.owner()).to.equal(owner.address);
    });

    it("Should have correct owner", async function () {
      expect(await rpsGame.owner()).to.equal(owner.address);
    });
  });

  describe("Game Creation", function () {
    it("Should create a game with valid bet amount", async function () {
      await expect(rpsGame.connect(player1).createGame({ value: DEFAULT_BET }))
        .to.emit(rpsGame, "GameCreated")
        .withArgs(0, player1.address, DEFAULT_BET);
      
      const game = await rpsGame.getGame(0);
      expect(game.player1).to.equal(player1.address);
      expect(game.player2).to.equal(ethers.ZeroAddress);
      expect(game.betAmount).to.equal(DEFAULT_BET);
      expect(game.state).to.equal(0); // Waiting
      expect(game.player1Revealed).to.be.false;
      expect(game.player2Revealed).to.be.false;
    });

    it("Should fail with bet amount below minimum", async function () {
      const lowBet = ethers.parseEther("0.0005");
      
      await expect(
        rpsGame.connect(player1).createGame({ value: lowBet })
      ).to.be.revertedWith("RPS: Invalid bet amount");
    });

    it("Should fail with bet amount above maximum", async function () {
      const highBet = ethers.parseEther("2");
      
      await expect(
        rpsGame.connect(player1).createGame({ value: highBet })
      ).to.be.revertedWith("RPS: Invalid bet amount");
    });

    it("Should fail with zero bet amount", async function () {
      await expect(
        rpsGame.connect(player1).createGame({ value: 0 })
      ).to.be.revertedWith("RPS: Invalid bet amount");
    });

    it("Should increment game counter", async function () {
      expect(await rpsGame.gameCounter()).to.equal(0);
      
      await rpsGame.connect(player1).createGame({ value: DEFAULT_BET });
      expect(await rpsGame.gameCounter()).to.equal(1);
      
      await rpsGame.connect(player2).createGame({ value: DEFAULT_BET });
      expect(await rpsGame.gameCounter()).to.equal(2);
    });

    it("Should add game to player's game list", async function () {
      await rpsGame.connect(player1).createGame({ value: DEFAULT_BET });
      
      const playerGames = await rpsGame.getPlayerGames(player1.address);
      expect(playerGames.length).to.equal(1);
      expect(playerGames[0]).to.equal(0);
    });
  });

  describe("Joining Games", function () {
    beforeEach(async function () {
      await rpsGame.connect(player1).createGame({ value: DEFAULT_BET });
    });

    it("Should allow a second player to join", async function () {
      await expect(rpsGame.connect(player2).joinGame(0, { value: DEFAULT_BET }))
        .to.emit(rpsGame, "PlayerJoined")
        .withArgs(0, player2.address);
      
      const game = await rpsGame.getGame(0);
      expect(game.player2).to.equal(player2.address);
      expect(game.state).to.equal(1); // Committed
    });

    it("Should fail if player tries to join their own game", async function () {
      await expect(
        rpsGame.connect(player1).joinGame(0, { value: DEFAULT_BET })
      ).to.be.revertedWith("RPS: Cannot join your own game");
    });

    it("Should fail if bet amount doesn't match", async function () {
      const wrongBet = ethers.parseEther("0.02");
      
      await expect(
        rpsGame.connect(player2).joinGame(0, { value: wrongBet })
      ).to.be.revertedWith("RPS: Bet amount must match");
    });

    it("Should fail if game already has two players", async function () {
      await rpsGame.connect(player2).joinGame(0, { value: DEFAULT_BET });
      
      await expect(
        rpsGame.connect(player3).joinGame(0, { value: DEFAULT_BET })
      ).to.be.revertedWith("RPS: Game already has two players");
    });

    it("Should fail if game doesn't exist", async function () {
      await expect(
        rpsGame.connect(player2).joinGame(999, { value: DEFAULT_BET })
      ).to.be.revertedWith("RPS: Game does not exist");
    });

    it("Should fail if game is not in waiting state", async function () {
      await rpsGame.connect(player2).joinGame(0, { value: DEFAULT_BET });
      
      await expect(
        rpsGame.connect(player3).joinGame(0, { value: DEFAULT_BET })
      ).to.be.revertedWith("RPS: Game already has two players");
    });

    it("Should add game to joining player's game list", async function () {
      await rpsGame.connect(player2).joinGame(0, { value: DEFAULT_BET });
      
      const playerGames = await rpsGame.getPlayerGames(player2.address);
      expect(playerGames.length).to.equal(1);
      expect(playerGames[0]).to.equal(0);
    });
  });

  describe("Move Commitment", function () {
    beforeEach(async function () {
      await rpsGame.connect(player1).createGame({ value: DEFAULT_BET });
      await rpsGame.connect(player2).joinGame(0, { value: DEFAULT_BET });
    });

    it("Should allow players to commit moves", async function () {
      const move = 1; // Rock
      const nonce = ethers.randomBytes(32);
      const commitment = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint8", "bytes32", "address"],
        [move, nonce, player1.address]
      ));
      
      await expect(rpsGame.connect(player1).commitMove(0, commitment))
        .to.emit(rpsGame, "MoveCommitted")
        .withArgs(0, player1.address, commitment);
    });

    it("Should fail if non-player tries to commit", async function () {
      const commitment = ethers.keccak256("test");
      
      await expect(
        rpsGame.connect(player3).commitMove(0, commitment)
      ).to.be.revertedWith("RPS: Only game players can call this function");
    });

    it("Should fail if game is not in committed state", async function () {
      const commitment = ethers.keccak256("test");
      
      // Try to commit before joining
      await rpsGame.connect(player1).createGame({ value: DEFAULT_BET });
      
      await expect(
        rpsGame.connect(player1).commitMove(1, commitment)
      ).to.be.revertedWith("RPS: Game is not in committed state");
    });

    it("Should fail if player already committed", async function () {
      const move = 1; // Rock
      const nonce = ethers.randomBytes(32);
      const commitment = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint8", "bytes32", "address"],
        [move, nonce, player1.address]
      ));
      
      await rpsGame.connect(player1).commitMove(0, commitment);
      
      // Try to commit again
      await expect(
        rpsGame.connect(player1).commitMove(0, commitment)
      ).to.be.revertedWith("RPS: Player 1 already committed");
    });

    it("Should transition to revealed state when both players commit", async function () {
      const move1 = 1; // Rock
      const move2 = 2; // Paper
      const nonce1 = ethers.randomBytes(32);
      const nonce2 = ethers.randomBytes(32);
      
      const commitment1 = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint8", "bytes32", "address"],
        [move1, nonce1, player1.address]
      ));
      
      const commitment2 = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint8", "bytes32", "address"],
        [move2, nonce2, player2.address]
      ));
      
      await rpsGame.connect(player1).commitMove(0, commitment1);
      
      let game = await rpsGame.getGame(0);
      expect(game.state).to.equal(1); // Still committed
      
      await rpsGame.connect(player2).commitMove(0, commitment2);
      
      game = await rpsGame.getGame(0);
      expect(game.state).to.equal(2); // Now revealed
    });
  });

  describe("Move Revelation", function () {
    let player1Move, player2Move, player1Nonce, player2Nonce;
    let player1Commitment, player2Commitment;

    beforeEach(async function () {
      await rpsGame.connect(player1).createGame({ value: DEFAULT_BET });
      await rpsGame.connect(player2).joinGame(0, { value: DEFAULT_BET });
      
      // Prepare moves and commitments
      player1Move = 1; // Rock
      player2Move = 2; // Paper
      player1Nonce = ethers.randomBytes(32);
      player2Nonce = ethers.randomBytes(32);
      
      player1Commitment = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint8", "bytes32", "address"],
        [player1Move, player1Nonce, player1.address]
      ));
      
      player2Commitment = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint8", "bytes32", "address"],
        [player2Move, player2Nonce, player2.address]
      ));
      
      // Commit moves
      await rpsGame.connect(player1).commitMove(0, player1Commitment);
      await rpsGame.connect(player2).commitMove(0, player2Commitment);
    });

    it("Should allow players to reveal moves", async function () {
      await expect(rpsGame.connect(player1).revealMove(0, player1Move, player1Nonce))
        .to.emit(rpsGame, "MoveRevealed")
        .withArgs(0, player1.address, player1Move, player1Nonce);
    });

    it("Should fail if commitment doesn't match", async function () {
      const wrongNonce = ethers.randomBytes(32);
      
      await expect(
        rpsGame.connect(player1).revealMove(0, player1Move, wrongNonce)
      ).to.be.revertedWith("RPS: Invalid commitment for player 1");
    });

    it("Should fail if move is invalid", async function () {
      await expect(
        rpsGame.connect(player1).revealMove(0, 0, player1Nonce) // Move.None
      ).to.be.revertedWith("RPS: Invalid move");
    });

    it("Should fail if player already revealed", async function () {
      await rpsGame.connect(player1).revealMove(0, player1Move, player1Nonce);
      
      await expect(
        rpsGame.connect(player1).revealMove(0, player1Move, player1Nonce)
      ).to.be.revertedWith("RPS: Player 1 already revealed");
    });

    it("Should determine winner correctly when both players reveal", async function () {
      // Player 1 reveals Rock
      await rpsGame.connect(player1).revealMove(0, player1Move, player1Nonce);
      
      // Player 2 reveals Paper (should win)
      const initialBalance = await ethers.provider.getBalance(player2.address);
      
      await expect(rpsGame.connect(player2).revealMove(0, player2Move, player2Nonce))
        .to.emit(rpsGame, "GameFinished")
        .withArgs(0, player2.address, DEFAULT_BET * 2n);
      
      const finalBalance = await ethers.provider.getBalance(player2.address);
      expect(finalBalance).to.be.gt(initialBalance);
    });

    it("Should handle ties correctly", async function () {
      // Both players choose Rock
      player2Move = 1; // Rock
      player2Commitment = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint8", "bytes32", "address"],
        [player2Move, player2Nonce, player2.address]
      ));
      
      // Re-commit with same move
      await rpsGame.connect(player2).commitMove(0, player2Commitment);
      
      const initialBalance1 = await ethers.provider.getBalance(player1.address);
      const initialBalance2 = await ethers.provider.getBalance(player2.address);
      
      await rpsGame.connect(player1).revealMove(0, player1Move, player1Nonce);
      await rpsGame.connect(player2).revealMove(0, player2Move, player2Nonce);
      
      const finalBalance1 = await ethers.provider.getBalance(player1.address);
      const finalBalance2 = await ethers.provider.getBalance(player2.address);
      
      // Both should get their bet back
      expect(finalBalance1).to.equal(initialBalance1.add(DEFAULT_BET));
      expect(finalBalance2).to.equal(initialBalance2.add(DEFAULT_BET));
    });

    it("Should test all winning combinations", async function () {
      const testCases = [
        { move1: 1, move2: 3, winner: 1 }, // Rock beats Scissors
        { move1: 2, move2: 1, winner: 1 }, // Paper beats Rock
        { move1: 3, move2: 2, winner: 1 }, // Scissors beats Paper
        { move1: 3, move2: 1, winner: 2 }, // Scissors loses to Rock
        { move1: 1, move2: 2, winner: 2 }, // Rock loses to Paper
        { move1: 2, move2: 3, winner: 2 }, // Paper loses to Scissors
      ];

      for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        
        // Create new game
        await rpsGame.connect(player1).createGame({ value: DEFAULT_BET });
        await rpsGame.connect(player2).joinGame(i + 1, { value: DEFAULT_BET });
        
        // Commit moves
        const nonce1 = ethers.randomBytes(32);
        const nonce2 = ethers.randomBytes(32);
        
        const commitment1 = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
          ["uint8", "bytes32", "address"],
          [testCase.move1, nonce1, player1.address]
        ));
        
        const commitment2 = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
          ["uint8", "bytes32", "address"],
          [testCase.move2, nonce2, player2.address]
        ));
        
        await rpsGame.connect(player1).commitMove(i + 1, commitment1);
        await rpsGame.connect(player2).commitMove(i + 1, commitment2);
        
        // Reveal moves
        await rpsGame.connect(player1).revealMove(i + 1, testCase.move1, nonce1);
        await rpsGame.connect(player2).revealMove(i + 1, testCase.move2, nonce2);
        
        // Check winner
        const game = await rpsGame.getGame(i + 1);
        expect(game.state).to.equal(3); // Finished
      }
    });
  });

  describe("Game Timeout", function () {
    beforeEach(async function () {
      await rpsGame.connect(player1).createGame({ value: DEFAULT_BET });
    });

    it("Should allow timeout after deadline", async function () {
      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [GAME_TIMEOUT + 1]);
      await ethers.provider.send("evm_mine");
      
      const initialBalance = await ethers.provider.getBalance(player1.address);
      
      await expect(rpsGame.connect(player3).timeoutGame(0))
        .to.emit(rpsGame, "GameTimeout")
        .withArgs(0);
      
      const finalBalance = await ethers.provider.getBalance(player1.address);
      expect(finalBalance).to.equal(initialBalance.add(DEFAULT_BET));
    });

    it("Should fail timeout before deadline", async function () {
      await expect(
        rpsGame.connect(player3).timeoutGame(0)
      ).to.be.revertedWith("RPS: Game has not timed out yet");
    });

    it("Should fail timeout for non-existent game", async function () {
      await ethers.provider.send("evm_increaseTime", [GAME_TIMEOUT + 1]);
      await ethers.provider.send("evm_mine");
      
      await expect(
        rpsGame.connect(player3).timeoutGame(999)
      ).to.be.revertedWith("RPS: Game does not exist");
    });

    it("Should fail timeout for finished game", async function () {
      await rpsGame.connect(player2).joinGame(0, { value: DEFAULT_BET });
      
      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [GAME_TIMEOUT + 1]);
      await ethers.provider.send("evm_mine");
      
      await rpsGame.connect(player3).timeoutGame(0);
      
      // Try to timeout again
      await expect(
        rpsGame.connect(player3).timeoutGame(0)
      ).to.be.revertedWith("RPS: Game is already finished");
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await rpsGame.connect(player1).createGame({ value: DEFAULT_BET });
      await rpsGame.connect(player2).createGame({ value: ethers.parseEther("0.02") });
    });

    it("Should return available games", async function () {
      const availableGames = await rpsGame.getAvailableGames();
      expect(availableGames.length).to.equal(2);
      expect(availableGames[0]).to.equal(0);
      expect(availableGames[1]).to.equal(1);
    });

    it("Should return player games", async function () {
      const player1Games = await rpsGame.getPlayerGames(player1.address);
      expect(player1Games.length).to.equal(1);
      expect(player1Games[0]).to.equal(0);
    });

    it("Should return correct game count", async function () {
      expect(await rpsGame.getPlayerGameCount(player1.address)).to.equal(1);
      expect(await rpsGame.getAvailableGameCount()).to.equal(2);
    });

    it("Should return empty arrays for new players", async function () {
      const newPlayerGames = await rpsGame.getPlayerGames(player3.address);
      expect(newPlayerGames.length).to.equal(0);
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to set min bet", async function () {
      const newMinBet = ethers.parseEther("0.005");
      
      await expect(rpsGame.setMinBet(newMinBet))
        .to.emit(rpsGame, "SettingUpdated")
        .withArgs("minBet", MIN_BET, newMinBet);
      
      expect(await rpsGame.minBet()).to.equal(newMinBet);
    });

    it("Should allow owner to set max bet", async function () {
      const newMaxBet = ethers.parseEther("2");
      
      await expect(rpsGame.setMaxBet(newMaxBet))
        .to.emit(rpsGame, "SettingUpdated")
        .withArgs("maxBet", MAX_BET, newMaxBet);
      
      expect(await rpsGame.maxBet()).to.equal(newMaxBet);
    });

    it("Should allow owner to set game timeout", async function () {
      const newTimeout = 7200; // 2 hours
      
      await expect(rpsGame.setGameTimeout(newTimeout))
        .to.emit(rpsGame, "SettingUpdated")
        .withArgs("gameTimeout", GAME_TIMEOUT, newTimeout);
      
      expect(await rpsGame.gameTimeout()).to.equal(newTimeout);
    });

    it("Should fail if non-owner tries to set min bet", async function () {
      const newMinBet = ethers.parseEther("0.005");
      
      await expect(
        rpsGame.connect(player1).setMinBet(newMinBet)
      ).to.be.revertedWith("RPS: Only owner can call this function");
    });

    it("Should fail if min bet is greater than max bet", async function () {
      const newMinBet = ethers.parseEther("2");
      
      await expect(
        rpsGame.setMinBet(newMinBet)
      ).to.be.revertedWith("RPS: Min bet must be less than max bet");
    });

    it("Should fail if max bet is less than min bet", async function () {
      const newMaxBet = ethers.parseEther("0.0005");
      
      await expect(
        rpsGame.setMaxBet(newMaxBet)
      ).to.be.revertedWith("RPS: Max bet must be greater than min bet");
    });

    it("Should fail if timeout is zero", async function () {
      await expect(
        rpsGame.setGameTimeout(0)
      ).to.be.revertedWith("RPS: Timeout must be greater than 0");
    });

    it("Should fail if timeout exceeds 24 hours", async function () {
      const longTimeout = 25 * 3600; // 25 hours
      
      await expect(
        rpsGame.setGameTimeout(longTimeout)
      ).to.be.revertedWith("RPS: Timeout cannot exceed 24 hours");
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow owner to emergency withdraw", async function () {
      // Send some ETH to contract
      await player1.sendTransaction({
        to: rpsGame.target,
        value: ethers.parseEther("1")
      });
      
      const initialBalance = await ethers.provider.getBalance(owner.address);
      
      await rpsGame.emergencyWithdraw();
      
      const finalBalance = await ethers.provider.getBalance(owner.address);
      expect(finalBalance).to.be.gt(initialBalance);
    });

    it("Should fail if non-owner tries to emergency withdraw", async function () {
      await expect(
        rpsGame.connect(player1).emergencyWithdraw()
      ).to.be.revertedWith("RPS: Only owner can call this function");
    });

    it("Should fail emergency withdraw if no funds", async function () {
      await expect(
        rpsGame.emergencyWithdraw()
      ).to.be.revertedWith("RPS: No funds to withdraw");
    });
  });

  describe("Edge Cases", function () {
    it("Should handle multiple games correctly", async function () {
      // Create multiple games
      await rpsGame.connect(player1).createGame({ value: DEFAULT_BET });
      await rpsGame.connect(player2).createGame({ value: DEFAULT_BET });
      await rpsGame.connect(player3).createGame({ value: DEFAULT_BET });
      
      expect(await rpsGame.gameCounter()).to.equal(3);
      
      // Join games
      await rpsGame.connect(player2).joinGame(0, { value: DEFAULT_BET });
      await rpsGame.connect(player1).joinGame(1, { value: DEFAULT_BET });
      await rpsGame.connect(player4).joinGame(2, { value: DEFAULT_BET });
      
      // Check player game counts
      expect(await rpsGame.getPlayerGameCount(player1.address)).to.equal(2);
      expect(await rpsGame.getPlayerGameCount(player2.address)).to.equal(2);
      expect(await rpsGame.getPlayerGameCount(player3.address)).to.equal(1);
      expect(await rpsGame.getPlayerGameCount(player4.address)).to.equal(1);
    });

    it("Should handle contract receiving ETH", async function () {
      const amount = ethers.parseEther("1");
      
      await player1.sendTransaction({
        to: rpsGame.target,
        value: amount
      });
      
      expect(await ethers.provider.getBalance(rpsGame.target)).to.equal(amount);
    });
  });
});
