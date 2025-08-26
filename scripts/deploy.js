const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying RPS Game contract to Abstract Chain...");

  // Get the contract factory
  const RPSGame = await ethers.getContractFactory("RPSGame");
  
  // Deploy the contract
  const rpsGame = await RPSGame.deploy();
  
  // Wait for deployment to complete
  await rpsGame.waitForDeployment();
  
  const contractAddress = await rpsGame.getAddress();
  
  console.log("RPS Game contract deployed to:", contractAddress);
  console.log("Network:", network.name);
  console.log("Chain ID:", network.config.chainId);
  
  // Verify the contract on Abstract Chain explorer
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("Waiting for block confirmations...");
    await rpsGame.deployTransaction.wait(6);
    
    console.log("Verifying contract on Abstract Chain explorer...");
    try {
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: [],
      });
      console.log("Contract verified successfully!");
    } catch (error) {
      console.log("Verification failed:", error.message);
    }
  }
  
  // Log initial configuration
  console.log("\nInitial Configuration:");
  console.log("Min Bet:", ethers.formatEther(await rpsGame.minBet()), "ETH");
  console.log("Max Bet:", ethers.formatEther(await rpsGame.maxBet()), "ETH");
  console.log("Game Timeout:", (await rpsGame.gameTimeout()).toString(), "seconds");
  
  console.log("\nDeployment completed successfully!");
  console.log("Contract Address:", contractAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
