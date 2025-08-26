require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    // Abstract Chain configuration
    abstract: {
      url: process.env.ABSTRACT_RPC_URL || "https://rpc.abstractchain.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: process.env.ABSTRACT_CHAIN_ID || 1234, // Replace with actual Abstract Chain ID
      gasPrice: process.env.GAS_PRICE || "auto",
    },
    // Testnet configuration
    abstractTestnet: {
      url: process.env.ABSTRACT_TESTNET_RPC_URL || "https://testnet-rpc.abstractchain.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: process.env.ABSTRACT_TESTNET_CHAIN_ID || 5678, // Replace with actual testnet Chain ID
      gasPrice: process.env.GAS_PRICE || "auto",
    },
    // Local development
    hardhat: {
      chainId: 31337,
    },
  },
  etherscan: {
    apiKey: {
      abstract: process.env.ABSTRACT_EXPLORER_API_KEY || "",
      abstractTestnet: process.env.ABSTRACT_TESTNET_EXPLORER_API_KEY || "",
    },
    customChains: [
      {
        network: "abstract",
        chainId: process.env.ABSTRACT_CHAIN_ID || 1234,
        urls: {
          apiURL: process.env.ABSTRACT_EXPLORER_API_URL || "https://explorer.abstractchain.com/api",
          browserURL: process.env.ABSTRACT_EXPLORER_URL || "https://explorer.abstractchain.com",
        },
      },
      {
        network: "abstractTestnet",
        chainId: process.env.ABSTRACT_TESTNET_CHAIN_ID || 5678,
        urls: {
          apiURL: process.env.ABSTRACT_TESTNET_EXPLORER_API_URL || "https://testnet-explorer.abstractchain.com/api",
          browserURL: process.env.ABSTRACT_TESTNET_EXPLORER_URL || "https://testnet-explorer.abstractchain.com",
        },
      },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
};
