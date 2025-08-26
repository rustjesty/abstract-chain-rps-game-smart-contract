const { ethers } = require("hardhat");

async function main() {
  console.log("RPS Game Contract Interaction Script");
  console.log("=====================================");

  // Get the deployed contract
  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress) {
    console.error("Please set CONTRACT_ADDRESS in your .env file");
    process.exit(1);
  }

  const RPSGame = await ethers.getContractFactory("RPSGame");
  const rpsGame = RPSGame.attach(contractAddress);

  console.log(`Contract Address: ${contractAddress}`);
  console.log(`Network: ${network.name}`);
  console.log(`Chain ID: ${network.config.chainId}`);

  // Get contract configuration
  console.log("\nContract Configuration:");
  console.log(`Min Bet: ${ethers.formatEther(await rpsGame.minBet())} ETH`);
  console.log(`Max Bet: ${ethers.formatEther(await rpsGame.maxBet())} ETH`);
  console.log(`Game Timeout: ${(await rpsGame.gameTimeout()).toString()} seconds`);
  console.log(`Total Games: ${(await rpsGame.gameCounter()).toString()}`);

  // Get available games
  console.log("\nAvailable Games:");
  const availableGames = await rpsGame.getAvailableGames();
  if (availableGames.length === 0) {
    console.log("No available games found.");
  } else {
    for (const gameId of availableGames) {
      const game = await rpsGame.getGame(gameId);
      console.log(`Game #${gameId}: ${ethers.formatEther(game.betAmount)} ETH bet`);
    }
  }

  // Example: Create a new game
  console.log("\nCreating a new game...");
  try {
    const betAmount = ethers.parseEther("0.01");
    const tx = await rpsGame.createGame({ value: betAmount });
    await tx.wait();
    console.log("✅ Game created successfully!");
    
    // Get the new game ID
    const newGameId = (await rpsGame.gameCounter()) - 1;
    console.log(`New Game ID: ${newGameId}`);
  } catch (error) {
    console.log(`❌ Error creating game: ${error.message}`);
  }

  // Example: Get player games
  const [signer] = await ethers.getSigners();
  console.log(`\nGames for ${signer.address}:`);
  const playerGames = await rpsGame.getPlayerGames(signer.address);
  if (playerGames.length === 0) {
    console.log("No games found for this player.");
  } else {
    for (const gameId of playerGames) {
      const game = await rpsGame.getGame(gameId);
      const states = ['Waiting', 'Committed', 'Revealed', 'Finished'];
      console.log(`Game #${gameId}: ${states[game.state]} - ${ethers.formatEther(game.betAmount)} ETH`);
    }
  }

  // Example: Commit a move (if you have an active game)
  if (playerGames.length > 0) {
    const gameId = playerGames[0];
    const game = await rpsGame.getGame(gameId);
    
    if (game.state === 1) { // Committed state
      console.log(`\nCommitting move for Game #${gameId}...`);
      try {
        const move = 1; // Rock
        const nonce = ethers.randomBytes(32);
        const commitment = ethers.keccak256(
          ethers.AbiCoder.defaultAbiCoder().encode(
            ['uint8', 'bytes32', 'address'],
            [move, nonce, signer.address]
          )
        );
        
        const tx = await rpsGame.commitMove(gameId, commitment);
        await tx.wait();
        console.log("✅ Move committed successfully!");
        console.log(`Move: Rock, Nonce: ${nonce}`);
      } catch (error) {
        console.log(`❌ Error committing move: ${error.message}`);
      }
    }
  }

  console.log("\nScript completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
