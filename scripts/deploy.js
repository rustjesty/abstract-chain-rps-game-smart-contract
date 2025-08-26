const { ethers } = require("hardhat");

/**
 * @title RPS Game Deployment Script
 * @description Deploys the Rock, Paper, Scissors smart contract to Abstract Chain
 */
async function main() {
  console.log("🚀 Deploying RPS Game contract to Abstract Chain...");
  console.log("==================================================");

  // Get the contract factory
  const RPSGame = await ethers.getContractFactory("RPSGame");
  
  console.log("📦 Contract factory created successfully");
  
  // Deploy the contract
  console.log("⏳ Deploying contract...");
  const rpsGame = await RPSGame.deploy();
  
  // Wait for deployment to complete
  console.log("⏳ Waiting for deployment confirmation...");
  await rpsGame.waitForDeployment();
  
  const contractAddress = await rpsGame.getAddress();
  
  console.log("✅ RPS Game contract deployed successfully!");
  console.log("📋 Deployment Details:");
  console.log(`   Contract Address: ${contractAddress}`);
  console.log(`   Network: ${network.name}`);
  console.log(`   Chain ID: ${network.config.chainId}`);
  console.log(`   Deployer: ${(await ethers.getSigners())[0].address}`);
  
  // Verify the contract on Abstract Chain explorer
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\n⏳ Waiting for block confirmations...");
    await rpsGame.deployTransaction.wait(6);
    
    console.log("🔍 Verifying contract on Abstract Chain explorer...");
    try {
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: [],
      });
      console.log("✅ Contract verified successfully!");
    } catch (error) {
      if (error.message.includes("Already Verified")) {
        console.log("ℹ️  Contract is already verified");
      } else {
        console.log("❌ Verification failed:", error.message);
        console.log("💡 You can verify manually using the following command:");
        console.log(`   npx hardhat verify --network ${network.name} ${contractAddress}`);
      }
    }
  }
  
  // Log initial configuration
  console.log("\n⚙️  Initial Configuration:");
  console.log(`   Min Bet: ${ethers.formatEther(await rpsGame.minBet())} ETH`);
  console.log(`   Max Bet: ${ethers.formatEther(await rpsGame.maxBet())} ETH`);
  console.log(`   Game Timeout: ${(await rpsGame.gameTimeout()).toString()} seconds`);
  console.log(`   Owner: ${await rpsGame.owner()}`);
  
  // Test basic functionality
  console.log("\n🧪 Testing basic functionality...");
  try {
    // Test game creation
    const testBet = ethers.parseEther("0.01");
    const tx = await rpsGame.createGame({ value: testBet });
    await tx.wait();
    
    console.log("✅ Game creation test passed");
    
    // Get game details
    const game = await rpsGame.getGame(0);
    console.log(`   Test Game ID: 0`);
    console.log(`   Player 1: ${game.player1}`);
    console.log(`   Bet Amount: ${ethers.formatEther(game.betAmount)} ETH`);
    console.log(`   State: ${game.state}`);
    
  } catch (error) {
    console.log("❌ Basic functionality test failed:", error.message);
  }
  
  // Save deployment info
  const deploymentInfo = {
    contractAddress: contractAddress,
    network: network.name,
    chainId: network.config.chainId,
    deployer: (await ethers.getSigners())[0].address,
    deploymentTime: new Date().toISOString(),
    minBet: ethers.formatEther(await rpsGame.minBet()),
    maxBet: ethers.formatEther(await rpsGame.maxBet()),
    gameTimeout: (await rpsGame.gameTimeout()).toString(),
    owner: await rpsGame.owner()
  };
  
  console.log("\n📄 Deployment Summary:");
  console.log("======================");
  console.log(`Contract Address: ${deploymentInfo.contractAddress}`);
  console.log(`Network: ${deploymentInfo.network}`);
  console.log(`Chain ID: ${deploymentInfo.chainId}`);
  console.log(`Deployer: ${deploymentInfo.deployer}`);
  console.log(`Deployment Time: ${deploymentInfo.deploymentTime}`);
  console.log(`Min Bet: ${deploymentInfo.minBet} ETH`);
  console.log(`Max Bet: ${deploymentInfo.maxBet} ETH`);
  console.log(`Game Timeout: ${deploymentInfo.gameTimeout} seconds`);
  console.log(`Owner: ${deploymentInfo.owner}`);
  
  console.log("\n🎉 Deployment completed successfully!");
  console.log("📝 Next steps:");
  console.log("   1. Update your frontend with the contract address");
  console.log("   2. Test the contract functionality");
  console.log("   3. Configure your dApp settings");
  console.log("   4. Share the contract address with users");
  
  // Save deployment info to file
  const fs = require('fs');
  const deploymentPath = `deployments/${network.name}.json`;
  
  // Create deployments directory if it doesn't exist
  if (!fs.existsSync('deployments')) {
    fs.mkdirSync('deployments');
  }
  
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n💾 Deployment info saved to: ${deploymentPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    console.error("Stack trace:", error.stack);
    process.exit(1);
  });
