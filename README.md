# Midnight ZK Voting DApp

A privacy-preserving decentralized voting application built on Midnight using Compact zero-knowledge smart contracts.

## demo video
▶️ [Watch Demo](https://github.com/nsampurnaa/midnight-app/issues/22#issue-5000634299)

## Contract Address

| Network | Contract Address |
|---------|------------------|
| Preprod | `<YOUR_DEPLOYED_CONTRACT_ADDRESS>` |

```env
CONTRACT_ADDRESS=<YOUR_DEPLOYED_CONTRACT_ADDRESS>
```

---

## Features

- **Anonymous ZK-Voting**: Voters cast their selection using zero-knowledge proofs without revealing their identity or wallet address.
- **On-Chain Aggregation**: Public counters keep track of total votes cast for each proposal option without linking individual votes to voters.
- **Transparent Proposal Lifecycle**: Proposals are initialized on-chain, opened for public voting, and closed when voting ends.
- **Full-Stack Web Interface**: Modern, responsive React dashboard featuring real-time state tracking and Midnight Lace wallet integration.
- **Interactive CLI Client**: Full CLI interface for deploying, joining, initializing, and casting votes directly from the command line.

---

## What This Project Does

The **Midnight ZK Voting DApp** allows organizations and communities to conduct tamper-proof elections and polls on the Midnight blockchain. Unlike traditional transparent smart contracts where every voter's wallet address and vote choice are publicly visible to everyone on-chain, this application uses Compact circuits to hide individual voter choices while producing mathematical ZK proofs of validity.

---

## Privacy Model

### Public Information (Stored On-Chain)
- Current election status (`UNINITIALIZED`, `VOTING_OPEN`, `VOTING_CLOSED`).
- The title/question of the active proposal.
- Aggregated vote count for Option A (Candidate A) and Option B (Candidate B).
- Total count of valid votes cast.

### Private Information (Kept Off-Chain)
- The voter's private secret key (`localSecretKey`).
- The individual vote choice selected by the voter prior to circuit disclosure.

### Zero-Knowledge Guarantees
- Voters prove they possess a valid, authorized voter key without revealing the key itself.
- ZK circuits compute vote validity off-chain, disclosing only aggregate vote counter increments to the public ledger.
- Observers cannot link a specific wallet address to a specific vote choice.

---

## Tech Stack

- **Smart Contracts**: Compact 0.5.1
- **Blockchain Framework**: Midnight JS SDK 4.1.1
- **Proof Generation**: Midnight Proof Server (Docker port 6300)
- **Frontend**: React 19, Vite, Material UI (MUI v9), RxJS
- **CLI**: Node.js, TypeScript, LevelDB Private State Provider
- **Language**: TypeScript 5.9, Node.js v22+

---

## Folder Structure

```
midnight-app/
├── contract/                       # Compact smart contract module
│   ├── src/
│   │   ├── voting.compact         # Compact smart contract source file
│   │   ├── index.ts               # Contract wrapper & exports
│   │   └── witnesses.ts           # Private witness definitions
│   └── package.json
├── api/                            # Contract API integration layer
│   ├── src/
│   │   ├── index.ts               # VotingAPI deployment & call bindings
│   │   └── common-types.ts        # Voting DApp state types & interfaces
│   └── package.json
├── voting-cli/                     # CLI client application
│   ├── src/
│   │   ├── index.ts               # CLI interactive menu driver
│   │   └── config.ts              # Network & proof server configurations
│   └── package.json
├── voting-ui/                      # Web Frontend application
│   ├── src/
│   │   ├── components/
│   │   │   └── Board.tsx          # Voting Dashboard UI component
│   │   └── contexts/
│   │       └── BrowserDeployedBoardManager.ts  # Lace Wallet connector manager
│   └── package.json
├── README.md                       # Documentation
└── package.json                    # Workspace root configuration
```

---

## Prerequisites

Before running locally, ensure you have the following installed:

- **Node.js**: v22 or higher (`node -v`)
- **Docker**: Installed and running (`docker ps`)
- **Compact Compiler**: Installed globally (`compact --version`)
- **Midnight Proof Server**: Pulled and running on Docker port 6300

```bash
docker run -p 6300:6300 midnightnetwork/proof-server
```

---

## Installation

Clone the repository and install dependencies across all workspaces:

```bash
npm install
```

Install workspace-specific dependencies:

```bash
cd contract && npm install && cd ..
cd api && npm install && cd ..
cd voting-cli && npm install && cd ..
cd voting-ui && npm install && cd ..
```

---

## Compile

To compile the `voting.compact` contract:

```bash
npm run compact
```

or directly inside the contract package:

```bash
cd contract
npm run compact
cd ..
```

---

## Build

To build all packages (`contract`, `api`, `voting-cli`, `voting-ui`):

```bash
npm run build
```

---

## Manual Deployment

Contract deployment is intentionally skipped in this repository.

To deploy the contract manually to the Midnight **Preprod** network, run:

```bash
NODE_OPTIONS="--max-old-space-size=12288" npm run deploy -- --network preprod
```

---

## After Deployment

After running the manual deployment command:

1. Copy the deployed contract address output by the CLI tool.
2. Replace every occurrence of `<YOUR_DEPLOYED_CONTRACT_ADDRESS>` in your environment configs and documentation with the actual contract address.

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_NETWORK_ID` | Targeted Midnight network (`preprod` or `preview`) | `preprod` |
| `VITE_LOGGING_LEVEL` | Pino logging severity level | `trace` |
| `CONTRACT_ADDRESS` | Deployed Midnight Compact contract address | `<YOUR_DEPLOYED_CONTRACT_ADDRESS>` |

---

## Screenshots

*(Add UI Screenshots Here)*

---

## Initial Idea

*(Paste original project idea details and custom requirements here)*

---

## Troubleshooting

### Proof Server Not Found
Ensure the Docker proof-server container is actively running on port 6300:
```bash
docker ps | grep proof-server
```

### Compact Compiler Error
Verify global installation of `compact`:
```bash
compact --version
```

### Lace Wallet Connection Failed
Ensure the Midnight Lace Chrome Extension is installed and unlocked in your browser.
