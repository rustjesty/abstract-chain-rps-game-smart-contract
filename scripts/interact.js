const { ethers } = require("hardhat");

/**
 * @title RPS Game Contract Interaction Script
 * @description Interactive script to test and interact with the deployed RPS smart contract
 */
async function main() {
  console.log("🎮 RPS Game Contract Interaction Script");
  console.log("=======================================");

  // Get the deployed contract
  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress) {
    console.error("❌ Please set CONTRACT_ADDRESS in your .env file");
    console.log("💡 Example: CONTRACT_ADDRESS=0x1234567890123456789012345678901234567890");
    process.exit(1);
  }

  const RPSGame = await ethers.getContractFactory("RPSGame");
  const rpsGame = RPSGame.attach(contractAddress);

  console.log(`📋 Contract Details:`);
  console.log(`   Address: ${contractAddress}`);
  console.log(`   Network: ${network.name}`);
  console.log(`   Chain ID: ${network.config.chainId}`);

  // Verify contract exists
  try {
    await rpsGame.owner();
  } catch (error) {
    console.error("❌ Contract not found at the specified address");
    console.error("   Make sure the contract is deployed and the address is correct");
    process.exit(1);
  }

  // Get contract configuration
  console.log("\n⚙️  Contract Configuration:");
  console.log(`   Min Bet: ${ethers.formatEther(await rpsGame.minBet())} ETH`);
  console.log(`   Max Bet: ${ethers.formatEther(await rpsGame.maxBet())} ETH`);
  console.log(`   Game Timeout: ${(await rpsGame.gameTimeout()).toString()} seconds`);
  console.log(`   Total Games: ${(await rpsGame.gameCounter()).toString()}`);
  console.log(`   Owner: ${await rpsGame.owner()}`);

  // Get available games
  console.log("\n🎲 Available Games:");
  const availableGames = await rpsGame.getAvailableGames();
  if (availableGames.length === 0) {
    console.log("   No available games found.");
  } else {
    console.log(`   Found ${availableGames.length} available game(s):`);
    for (const gameId of availableGames) {
      const game = await rpsGame.getGame(gameId);
      console.log(`   Game #${gameId}: ${ethers.formatEther(game.betAmount)} ETH bet`);
    }
  }

  // Get current player's games
  const [signer] = await ethers.getSigners();
  console.log(`\n👤 Games for ${signer.address}:`);
  const playerGames = await rpsGame.getPlayerGames(signer.address);
  if (playerGames.length === 0) {
    console.log("   No games found for this player.");
  } else {
    console.log(`   Found ${playerGames.length} game(s):`);
    for (const gameId of playerGames) {
      const game = await rpsGame.getGame(gameId);
      const states = ['Waiting', 'Committed', 'Revealed', 'Finished'];
      console.log(`   Game #${gameId}: ${states[game.state]} - ${ethers.formatEther(game.betAmount)} ETH`);
    }
  }

  // Example: Create a new game
  console.log("\n🎯 Creating a new game...");
  try {
    const betAmount = ethers.parseEther("0.01");
    const tx = await rpsGame.createGame({ value: betAmount });
    console.log("   ⏳ Transaction sent, waiting for confirmation...");
    await tx.wait();
    console.log("   ✅ Game created successfully!");
    
    // Get the new game ID
    const newGameId = (await rpsGame.gameCounter()) - 1;
    console.log(`   📋 New Game ID: ${newGameId}`);
    
    // Update available games
    const updatedAvailableGames = await rpsGame.getAvailableGames();
    console.log(`   📊 Total available games: ${updatedAvailableGames.length}`);
    
  } catch (error) {
    console.log(`   ❌ Error creating game: ${error.message}`);
  }

  // Example: Join an available game (if any)
  const currentAvailableGames = await rpsGame.getAvailableGames();
  if (currentAvailableGames.length > 0) {
    console.log("\n🎮 Joining an available game...");
    try {
      const gameIdToJoin = currentAvailableGames[0];
      const gameToJoin = await rpsGame.getGame(gameIdToJoin);
      
      console.log(`   📋 Joining Game #${gameIdToJoin} with ${ethers.formatEther(gameToJoin.betAmount)} ETH bet`);
      
      const tx = await rpsGame.joinGame(gameIdToJoin, { value: gameToJoin.betAmount });
      console.log("   ⏳ Transaction sent, waiting for confirmation...");
      await tx.wait();
      console.log("   ✅ Successfully joined the game!");
      
    } catch (error) {
      console.log(`   ❌ Error joining game: ${error.message}`);
    }
  }

  // Example: Commit a move (if you have an active game in committed state)
  const currentPlayerGames = await rpsGame.getPlayerGames(signer.address);
  const committedGames = [];
  
  for (const gameId of currentPlayerGames) {
    const game = await rpsGame.getGame(gameId);
    if (game.state === 1) { // Committed state
      committedGames.push(gameId);
    }
  }
  
  if (committedGames.length > 0) {
    console.log("\n🎯 Committing a move...");
    try {
      const gameId = committedGames[0];
      const move = 1; // Rock
      const nonce = ethers.randomBytes(32);
      const commitment = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['uint8', 'bytes32', 'address'],
          [move, nonce, signer.address]
        )
      );
      
      console.log(`   📋 Committing move for Game #${gameId}`);
      console.log(`   🎯 Move: Rock (${move})`);
      console.log(`   🔑 Nonce: ${nonce}`);
      console.log(`   🔐 Commitment: ${commitment}`);
      
      const tx = await rpsGame.commitMove(gameId, commitment);
      console.log("   ⏳ Transaction sent, waiting for confirmation...");
      await tx.wait();
      console.log("   ✅ Move committed successfully!");
      
      // Save commitment details for later revelation
      console.log("   💾 Save these details for move revelation:");
      console.log(`      Game ID: ${gameId}`);
      console.log(`      Move: ${move}`);
      console.log(`      Nonce: ${nonce}`);
      
    } catch (error) {
      console.log(`   ❌ Error committing move: ${error.message}`);
    }
  }

  // Example: Get detailed game information
  if (currentPlayerGames.length > 0) {
    console.log("\n📊 Detailed Game Information:");
    for (const gameId of currentPlayerGames) {
      const game = await rpsGame.getGame(gameId);
      const states = ['Waiting', 'Committed', 'Revealed', 'Finished'];
      const moves = ['None', 'Rock', 'Paper', 'Scissors'];
      
      console.log(`\n   Game #${gameId}:`);
      console.log(`   State: ${states[game.state]}`);
      console.log(`   Player 1: ${game.player1}`);
      console.log(`   Player 2: ${game.player2 || 'None'}`);
      console.log(`   Bet Amount: ${ethers.formatEther(game.betAmount)} ETH`);
      console.log(`   Player 1 Move: ${moves[game.player1Move]}`);
      console.log(`   Player 2 Move: ${moves[game.player2Move]}`);
      console.log(`   Player 1 Revealed: ${game.player1Revealed ? 'Yes' : 'No'}`);
      console.log(`   Player 2 Revealed: ${game.player2Revealed ? 'Yes' : 'No'}`);
      console.log(`   Deadline: ${new Date(game.deadline * 1000).toLocaleString()}`);
    }
  }

  // Example: Check for games that can be timed out
  console.log("\n⏰ Checking for games that can be timed out...");
  const allGames = [];
  for (let i = 0; i < await rpsGame.gameCounter(); i++) {
    const game = await rpsGame.getGame(i);
    if (game.state !== 3 && block.timestamp >= game.deadline) { // Not finished and timed out
      allGames.push(i);
    }
  }
  
  if (allGames.length > 0) {
    console.log(`   Found ${allGames.length} game(s) that can be timed out:`);
    for (const gameId of allGames) {
      console.log(`   Game #${gameId}`);
    }
    
    // Timeout the first game
    console.log("\n⏰ Timing out a game...");
    try {
      const gameIdToTimeout = allGames[0];
      const tx = await rpsGame.timeoutGame(gameIdToTimeout);
      console.log(`   ⏳ Timing out Game #${gameIdToTimeout}...`);
      await tx.wait();
      console.log("   ✅ Game timed out successfully!");
    } catch (error) {
      console.log(`   ❌ Error timing out game: ${error.message}`);
    }
  } else {
    console.log("   No games need to be timed out.");
  }

  // Contract statistics
  console.log("\n📈 Contract Statistics:");
  console.log(`   Total Games Created: ${await rpsGame.gameCounter()}`);
  console.log(`   Available Games: ${await rpsGame.getAvailableGameCount()}`);
  console.log(`   Your Games: ${await rpsGame.getPlayerGameCount(signer.address)}`);
  
  // Contract balance
  const contractBalance = await ethers.provider.getBalance(rpsGame.target);
  console.log(`   Contract Balance: ${ethers.formatEther(contractBalance)} ETH`);

  console.log("\n🎉 Interaction script completed!");
  console.log("📝 Next steps:");
  console.log("   1. Use the frontend to interact with the contract");
  console.log("   2. Test different game scenarios");
  console.log("   3. Monitor contract events");
  console.log("   4. Check game outcomes and fund distributions");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Interaction script failed:", error);
    console.error("Stack trace:", error.stack);
    process.exit(1);
  });
