
A decentralized Rock, Paper, Scissors game smart contract designed to run on Abstract Chain. This contract implements a commitment scheme to ensure fair play and prevent cheating.

## Features

- **Fair Play**: Uses cryptographic commitments to prevent players from seeing each other's moves before committing
- **Betting System**: Players can bet native tokens (ETH/ABST) on game outcomes
- **Timeout Mechanism**: Games automatically timeout if players don't complete their moves
- **Tie Handling**: Proper handling of ties with fund distribution
- **Gas Efficient**: Optimized for minimal gas consumption on Abstract Chain

## Game Flow

1. **Game Creation**: Player 1 creates a game with a bet amount
2. **Game Joining**: Player 2 joins the game with matching bet amount
3. **Move Commitment**: Both players commit their moves using cryptographic hashes
4. **Move Revelation**: Players reveal their moves with the original nonce
5. **Winner Determination**: Smart contract determines winner and distributes funds

## Smart Contract Functions

### Core Game Functions
- `createGame()` - Create a new game with bet amount
- `joinGame(uint256 gameId)` - Join an existing game
- `commitMove(uint256 gameId, bytes32 commitment)` - Commit a move
- `revealMove(uint256 gameId, Move move, bytes32 nonce)` - Reveal a move
- `timeoutGame(uint256 gameId)` - Timeout a game after deadline

### View Functions
- `getGame(uint256 gameId)` - Get game details
- `getPlayerGames(address player)` - Get all games for a player
- `getAvailableGames()` - Get all available games to join

### Admin Functions
- `setMinBet(uint256 _minBet)` - Set minimum bet amount
- `setMaxBet(uint256 _maxBet)` - Set maximum bet amount
- `setGameTimeout(uint256 _timeout)` - Set game timeout duration

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd abstract-smart-contract
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment file and configure:
```bash
cp env.example .env
```

4. Edit `.env` file with your Abstract Chain configuration:
```env
# Abstract Chain Configuration
ABSTRACT_RPC_URL=https://rpc.abstractchain.com
ABSTRACT_CHAIN_ID=1234
PRIVATE_KEY=your_private_key_here
```

## Configuration

### Abstract Chain Settings

Update the `hardhat.config.js` file with the correct Abstract Chain parameters:

```javascript
networks: {
  abstract: {
    url: process.env.ABSTRACT_RPC_URL,
    accounts: [process.env.PRIVATE_KEY],
    chainId: process.env.ABSTRACT_CHAIN_ID,
  },
  abstractTestnet: {
    url: process.env.ABSTRACT_TESTNET_RPC_URL,
    accounts: [process.env.PRIVATE_KEY],
    chainId: process.env.ABSTRACT_TESTNET_CHAIN_ID,
  }
}
```

### Environment Variables

- `ABSTRACT_RPC_URL`: Abstract Chain RPC endpoint
- `ABSTRACT_CHAIN_ID`: Abstract Chain network ID
- `PRIVATE_KEY`: Your wallet private key for deployment
- `ABSTRACT_EXPLORER_API_KEY`: Explorer API key for contract verification

## Usage

### Compile Contracts
```bash
npm run compile
```

### Run Tests
```bash
npm run test
```

### Deploy to Local Network
```bash
npm run deploy:local
```

### Deploy to Abstract Chain Testnet
```bash
npm run deploy:testnet
```

### Deploy to Abstract Chain Mainnet
```bash
npm run deploy:mainnet
```

### Verify Contract
```bash
npm run verify:testnet
npm run verify:mainnet
```

## Game Mechanics

### Move Encoding
Moves are encoded as follows:
- 0: None (invalid)
- 1: Rock
- 2: Paper
- 3: Scissors

### Commitment Scheme
Players commit their moves using:
```solidity
commitment = keccak256(abi.encodePacked(move, nonce, playerAddress))
```

### Winner Logic
- Rock beats Scissors
- Paper beats Rock
- Scissors beats Paper
- Same moves result in a tie

### Fund Distribution
- **Winner**: Receives both players' bets (minus gas fees)
- **Tie**: Each player receives their original bet back
- **Timeout**: Each player receives their original bet back

## Security Features

1. **Commitment Scheme**: Prevents front-running and move manipulation
2. **Timeout Mechanism**: Prevents games from being stuck indefinitely
3. **Access Control**: Only game participants can perform game actions
4. **State Validation**: Ensures games follow proper state transitions
5. **Fund Safety**: Secure fund handling with proper withdrawal mechanisms

## Gas Optimization

The contract is optimized for Abstract Chain with:
- Efficient storage patterns
- Minimal external calls
- Optimized loops and data structures
- Batch operations where possible

## Testing

Run the comprehensive test suite:
```bash
npm run test
```

Tests cover:
- Game creation and joining
- Move commitment and revelation
- Winner determination
- Timeout handling
- Edge cases and error conditions

## Deployment Checklist

Before deploying to Abstract Chain:

- [ ] Update RPC URLs in configuration
- [ ] Set correct chain IDs
- [ ] Configure explorer settings
- [ ] Test on local network
- [ ] Test on testnet
- [ ] Verify contract source code
- [ ] Set appropriate gas limits

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions about Abstract Chain integration, please refer to the Abstract Chain documentation or create an issue in this repository.

## Disclaimer

This smart contract is provided as-is for educational and development purposes. Always audit smart contracts before using them with real funds on mainnet.