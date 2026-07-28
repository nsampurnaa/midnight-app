/*
 * Main driver CLI for the Midnight Voting DApp.
 */

import { createInterface, type Interface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { WebSocket } from 'ws';
import {
  VotingAPI,
  type VotingDerivedState,
  votingPrivateStateKey,
  type VotingProviders,
  type DeployedVotingContract,
  type PrivateStateId,
} from '../../api/src/index.js';
import { type WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { ledger, type Ledger, State } from '../../contract/src/managed/voting/contract/index.js';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { type Logger } from 'pino';
import { type Config, StandaloneConfig } from './config.js';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { type ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { assertIsContractAddress, toHex } from '@midnight-ntwrk/midnight-js-utils';
import { TestEnvironment } from '@midnight-ntwrk/testkit-js';
import { MidnightWalletProvider } from './midnight-wallet-provider.js';
import { randomBytes } from '../../api/src/utils/index.js';
import { unshieldedToken } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { syncWallet, waitForUnshieldedFunds } from './wallet-utils.js';
import { generateDust } from './generate-dust.js';
import { VotingPrivateState } from '../../contract/src/witnesses.js';

// @ts-expect-error: Needed to enable WebSocket usage through apollo
globalThis.WebSocket = WebSocket;

export const getVotingLedgerState = async (
  providers: VotingProviders,
  contractAddress: ContractAddress,
): Promise<Ledger | null> => {
  assertIsContractAddress(contractAddress);
  const contractState = await providers.publicDataProvider.queryContractState(contractAddress);
  return contractState != null ? ledger(contractState.data) : null;
};

const DEPLOY_OR_JOIN_QUESTION = `
You can do one of the following:
  1. Deploy a new Voting contract
  2. Join an existing Voting contract
  3. Exit
Which would you like to do? `;

const deployOrJoin = async (providers: VotingProviders, rli: Interface, logger: Logger): Promise<VotingAPI | null> => {
  let api: VotingAPI | null = null;

  while (true) {
    const choice = await rli.question(DEPLOY_OR_JOIN_QUESTION);
    switch (choice) {
      case '1':
        api = await VotingAPI.deploy(providers, logger);
        logger.info(`Deployed contract at address: ${api.deployedContractAddress}`);
        return api;
      case '2':
        api = await VotingAPI.join(providers, await rli.question('What is the contract address (in hex)? '), logger);
        logger.info(`Joined contract at address: ${api.deployedContractAddress}`);
        return api;
      case '3':
        logger.info('Exiting...');
        return null;
      default:
        logger.error(`Invalid choice: ${choice}`);
    }
  }
};

const displayLedgerState = async (
  providers: VotingProviders,
  deployedVotingContract: DeployedVotingContract,
  logger: Logger,
): Promise<void> => {
  const contractAddress = deployedVotingContract.deployTxData.public.contractAddress;
  const ledgerState = await getVotingLedgerState(providers, contractAddress);
  if (ledgerState === null) {
    logger.info(`There is no voting contract deployed at ${contractAddress}`);
  } else {
    const stateStr = ledgerState.state === State.UNINITIALIZED ? 'UNINITIALIZED' : ledgerState.state === State.VOTING_OPEN ? 'VOTING_OPEN' : 'VOTING_CLOSED';
    const title = ledgerState.proposalTitle.is_some ? ledgerState.proposalTitle.value : 'No proposal set';
    logger.info(`Status: '${stateStr}'`);
    logger.info(`Proposal Title: '${title}'`);
    logger.info(`Candidate A Votes: ${ledgerState.candidateAVotes}`);
    logger.info(`Candidate B Votes: ${ledgerState.candidateBVotes}`);
    logger.info(`Total Votes: ${ledgerState.totalVotes}`);
  }
};

const displayPrivateState = async (providers: VotingProviders, logger: Logger): Promise<void> => {
  const privateState = await providers.privateStateProvider.get(votingPrivateStateKey);
  if (privateState === null) {
    logger.info(`There is no existing voting private state`);
  } else {
    logger.info(`Current secret key is: ${toHex(privateState.secretKey)}`);
  }
};

const displayDerivedState = (ledgerState: VotingDerivedState | undefined, logger: Logger) => {
  if (ledgerState === undefined) {
    logger.info(`No voting state currently available`);
  } else {
    const stateStr = ledgerState.state === State.UNINITIALIZED ? 'UNINITIALIZED' : ledgerState.state === State.VOTING_OPEN ? 'VOTING_OPEN' : 'VOTING_CLOSED';
    logger.info(`Status: '${stateStr}'`);
    logger.info(`Proposal Title: '${ledgerState.proposalTitle}'`);
    logger.info(`Candidate A Votes: ${ledgerState.candidateAVotes}`);
    logger.info(`Candidate B Votes: ${ledgerState.candidateBVotes}`);
    logger.info(`Total Votes: ${ledgerState.totalVotes}`);
  }
};

const MAIN_LOOP_QUESTION = `
You can do one of the following:
  1. Initialize Proposal
  2. Vote for Candidate A (Option 0)
  3. Vote for Candidate B (Option 1)
  4. Close Voting
  5. Display Ledger State
  6. Display Private State
  7. Display Derived State
  8. Exit
Which would you like to do? `;

const mainLoop = async (providers: VotingProviders, rli: Interface, logger: Logger): Promise<void> => {
  const votingApi = await deployOrJoin(providers, rli, logger);
  if (votingApi === null) {
    return;
  }
  let currentState: VotingDerivedState | undefined;
  const stateObserver = {
    next: (state: VotingDerivedState) => (currentState = state),
  };
  const subscription = votingApi.state$.subscribe(stateObserver);
  try {
    while (true) {
      const choice = await rli.question(MAIN_LOOP_QUESTION);
      try {
        switch (choice) {
          case '1': {
            const title = await rli.question('Enter proposal title: ');
            await votingApi.initialize(title);
            logger.info('Proposal initialized successfully!');
            break;
          }
          case '2':
            await votingApi.vote(0);
            logger.info('Vote cast for Candidate A!');
            break;
          case '3':
            await votingApi.vote(1);
            logger.info('Vote cast for Candidate B!');
            break;
          case '4':
            await votingApi.closeVoting();
            logger.info('Voting session closed!');
            break;
          case '5':
            await displayLedgerState(providers, votingApi.deployedContract, logger);
            break;
          case '6':
            await displayPrivateState(providers, logger);
            break;
          case '7':
            displayDerivedState(currentState, logger);
            break;
          case '8':
            logger.info('Exiting...');
            return;
          default:
            logger.error(`Invalid choice: ${choice}`);
        }
      } catch (e) {
        logError(logger, e);
        logger.info('Returning to main menu...');
      }
    }
  } finally {
    subscription.unsubscribe();
  }
};

const GENESIS_MINT_WALLET_SEED = '0000000000000000000000000000000000000000000000000000000000000001';

const WALLET_LOOP_QUESTION = `
You can do one of the following:
  1. Build a fresh wallet
  2. Build wallet from a seed
  3. Exit
Which would you like to do? `;

const buildWallet = async (config: Config, rli: Interface, logger: Logger): Promise<string | undefined> => {
  if (config instanceof StandaloneConfig) {
    return GENESIS_MINT_WALLET_SEED;
  }
  while (true) {
    const choice = await rli.question(WALLET_LOOP_QUESTION);
    switch (choice) {
      case '1':
        return toHex(randomBytes(32));
      case '2':
        return await rli.question('Enter your wallet seed: ');
      case '3':
        logger.info('Exiting...');
        return undefined;
      default:
        logger.error(`Invalid choice: ${choice}`);
    }
  }
};

export const run = async (config: Config, testEnv: TestEnvironment, logger: Logger): Promise<void> => {
  const rli = createInterface({ input, output, terminal: true });
  const providersToBeStopped: MidnightWalletProvider[] = [];
  try {
    const envConfiguration = await testEnv.start();
    logger.info(`Environment started with configuration: ${JSON.stringify(envConfiguration)}`);
    const seed = await buildWallet(config, rli, logger);
    if (seed === undefined) {
      return;
    }
    const walletProvider = await MidnightWalletProvider.build(logger, envConfiguration, seed);
    providersToBeStopped.push(walletProvider);
    const walletFacade: WalletFacade = walletProvider.wallet;

    await walletProvider.start();

    const unshieldedState = await waitForUnshieldedFunds(logger, walletFacade, envConfiguration, unshieldedToken());
    const nightBalance = unshieldedState.balances[unshieldedToken().raw];
    if (nightBalance === undefined) {
      logger.info('No funds received, exiting...');
      return;
    }
    logger.info(`Your NIGHT wallet balance is: ${nightBalance}`);

    if (config.generateDust) {
      const dustGeneration = await generateDust(logger, seed, unshieldedState, walletFacade);
      if (dustGeneration) {
        logger.info(`Submitted dust generation registration transaction: ${dustGeneration}`);
        await syncWallet(logger, walletFacade);
      }
    }

    const zkConfigProvider = new NodeZkConfigProvider<'initialize' | 'vote' | 'closeVoting'>(config.zkConfigPath);
    const providers: VotingProviders = {
      privateStateProvider: levelPrivateStateProvider<PrivateStateId, VotingPrivateState>({
        privateStateStoreName: config.privateStateStoreName,
        signingKeyStoreName: `${config.privateStateStoreName}-signing-keys`,
        privateStoragePasswordProvider: () => {
          return 'Voting-Test-2026!';
        },
        accountId: seed,
      }),
      publicDataProvider: indexerPublicDataProvider(envConfiguration.indexer, envConfiguration.indexerWS),
      zkConfigProvider: zkConfigProvider,
      proofProvider: httpClientProofProvider(envConfiguration.proofServer, zkConfigProvider),
      walletProvider: walletProvider,
      midnightProvider: walletProvider,
    };
    await mainLoop(providers, rli, logger);
  } catch (e) {
    logError(logger, e);
    logger.info('Exiting...');
  } finally {
    try {
      rli.close();
      rli.removeAllListeners();
    } catch (e) {
      logError(logger, e);
    } finally {
      try {
        for (const wallet of providersToBeStopped) {
          logger.info('Stopping wallet...');
          await wallet.stop();
        }
        if (testEnv) {
          logger.info('Stopping test environment...');
          await testEnv.shutdown();
        }
      } catch (e) {
        logError(logger, e);
      }
    }
  }
};

function logError(logger: Logger, e: unknown) {
  if (e instanceof Error) {
    logger.error(`Found error '${e.message}'`);
    logger.debug(`${e.stack}`);
  } else {
    logger.error(`Found error (unknown type)`);
  }
}
