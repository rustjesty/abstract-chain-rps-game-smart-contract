const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RPSGame", function () {
  let RPSGame;
  let rpsGame;
  let owner;
  let player1;
  let player2;
  let player3;

  beforeEach(async function () {
    [owner, player1, player2, player3] = await ethers.getSigners();
    
    RPSGame = await ethers.getContractFactory("RPSGame");
    rpsGame = await RPSGame.deploy();
  });

  describe("Deployment", function () {
    it("Should set the correct initial values", async function () {
      expect(await rpsGame.minBet()).to.equal(ethers.parseEther("0.001"));
      expect(await rpsGame.maxBet()).to.equal(ethers.parseEther("1"));
      expect(await rpsGame.gameTimeout()).to.equal(3600); // 1 hour
      expect(await rpsGame.gameCounter()).to.equal(0);
    });
  });

  describe("Game Creation", function () {
    it("Should create a game with valid bet amount", async function () {
      const betAmount = ethers.parseEther("0.01");
      
      await expect(rpsGame.connect(player1).createGame({ value: betAmount }))
        .to.emit(rpsGame, "GameCreated")
        .withArgs(0, player1.address, betAmount);
      
      const game = await rpsGame.getGame(0);
      expect(game.player1).to.equal(player1.address);
      expect(game.player2).to.equal(ethers.ZeroAddress);
      expect(game.betAmount).to.equal(betAmount);
      expect(game.state).to.equal(0); // Waiting
    });

    it("Should fail with bet amount below minimum", async function () {
      const betAmount = ethers.parseEther("0.0005");
      
      await expect(
        rpsGame.connect(player1).createGame({ value: betAmount })
      ).to.be.revertedWith("Invalid bet amount");
    });

    it("Should fail with bet amount above maximum", async function () {
      const betAmount = ethers.parseEther("2");
      
      await expect(
        rpsGame.connect(player1).createGame({ value: betAmount })
      ).to.be.revertedWith("Invalid bet amount");
    });
  });

  describe("Joining Games", function () {
    beforeEach(async function () {
      await rpsGame.connect(player1).createGame({ value: ethers.parseEther("0.01") });
    });

    it("Should allow a second player to join", async function () {
      await expect(rpsGame.connect(player2).joinGame(0, { value: ethers.parseEther("0.01") }))
        .to.emit(rpsGame, "PlayerJoined")
        .withArgs(0, player2.address);
      
      const game = await rpsGame.getGame(0);
      expect(game.player2).to.equal(player2.address);
      expect(game.state).to.equal(1); // Committed
    });

    it("Should fail if player tries to join their own game", async function () {
      await expect(
        rpsGame.connect(player1).joinGame(0, { value: ethers.parseEther("0.01") })
      ).to.be.revertedWith("Cannot join your own game");
    });

    it("Should fail if bet amount doesn't match", async function () {
      await expect(
        rpsGame.connect(player2).joinGame(0, { value: ethers.parseEther("0.02") })
      ).to.be.revertedWith("Bet amount must match");
    });

    it("Should fail if game already has two players", async function () {
      await rpsGame.connect(player2).joinGame(0, { value: ethers.parseEther("0.01") });
      
      await expect(
        rpsGame.connect(player3).joinGame(0, { value: ethers.parseEther("0.01") })
      ).to.be.revertedWith("Game already has two players");
    });
  });

  describe("Move Commitment", function () {
    beforeEach(async function () {
      await rpsGame.connect(player1).createGame({ value: ethers.parseEther("0.01") });
      await rpsGame.connect(player2).joinGame(0, { value: ethers.parseEther("0.01") });
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
      ).to.be.revertedWith("Only game players can call this function");
    });
  });

  describe("Move Revelation", function () {
    let player1Move, player2Move, player1Nonce, player2Nonce;
    let player1Commitment, player2Commitment;

    beforeEach(async function () {
      await rpsGame.connect(player1).createGame({ value: ethers.parseEther("0.01") });
      await rpsGame.connect(player2).joinGame(0, { value: ethers.parseEther("0.01") });
      
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

    it("Should determine winner correctly when both players reveal", async function () {
      // Player 1 reveals Rock
      await rpsGame.connect(player1).revealMove(0, player1Move, player1Nonce);
      
      // Player 2 reveals Paper (should win)
      const initialBalance = await ethers.provider.getBalance(player2.address);
      
      await expect(rpsGame.connect(player2).revealMove(0, player2Move, player2Nonce))
        .to.emit(rpsGame, "GameFinished")
        .withArgs(0, player2.address, ethers.parseEther("0.02"));
      
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
      expect(finalBalance1).to.equal(initialBalance1.add(ethers.parseEther("0.01")));
      expect(finalBalance2).to.equal(initialBalance2.add(ethers.parseEther("0.01")));
    });
  });

  describe("Game Timeout", function () {
    beforeEach(async function () {
      await rpsGame.connect(player1).createGame({ value: ethers.parseEther("0.01") });
    });

    it("Should allow timeout after deadline", async function () {
      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [3601]); // 1 hour + 1 second
      await ethers.provider.send("evm_mine");
      
      const initialBalance = await ethers.provider.getBalance(player1.address);
      
      await expect(rpsGame.connect(player3).timeoutGame(0))
        .to.emit(rpsGame, "GameTimeout")
        .withArgs(0);
      
      const finalBalance = await ethers.provider.getBalance(player1.address);
      expect(finalBalance).to.equal(initialBalance.add(ethers.parseEther("0.01")));
    });

    it("Should fail timeout before deadline", async function () {
      await expect(
        rpsGame.connect(player3).timeoutGame(0)
      ).to.be.revertedWith("Game has not timed out yet");
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await rpsGame.connect(player1).createGame({ value: ethers.parseEther("0.01") });
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
  });

  describe("Admin Functions", function () {
    it("Should allow setting min bet", async function () {
      const newMinBet = ethers.parseEther("0.005");
      await rpsGame.setMinBet(newMinBet);
      expect(await rpsGame.minBet()).to.equal(newMinBet);
    });

    it("Should allow setting max bet", async function () {
      const newMaxBet = ethers.parseEther("2");
      await rpsGame.setMaxBet(newMaxBet);
      expect(await rpsGame.maxBet()).to.equal(newMaxBet);
    });

    it("Should allow setting game timeout", async function () {
      const newTimeout = 7200; // 2 hours
      await rpsGame.setGameTimeout(newTimeout);
      expect(await rpsGame.gameTimeout()).to.equal(newTimeout);
    });
  });
});
