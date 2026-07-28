/**
 * Provides types and utilities for working with Midnight voting contracts.
 *
 * @packageDocumentation
 */

import * as Voting from '../../contract/src/managed/voting/contract/index.js';

import { type ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { type Logger } from 'pino';
import {
  type VotingDerivedState,
  type VotingContract,
  type VotingProviders,
  type DeployedVotingContract,
  votingPrivateStateKey,
} from './common-types.js';
import { CompiledVotingContractContract } from '../../contract/src/index.js';
import * as utils from './utils/index.js';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { combineLatest, map, tap, from, type Observable } from 'rxjs';
import { VotingPrivateState, createVotingPrivateState } from '../../contract/src/witnesses.js';

export interface DeployedVotingAPI {
  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<VotingDerivedState>;

  initialize: (title: string) => Promise<void>;
  vote: (choice: number) => Promise<void>;
  closeVoting: () => Promise<void>;
}

export class VotingAPI implements DeployedVotingAPI {
  private constructor(
    public readonly deployedContract: DeployedVotingContract,
    providers: VotingProviders,
    private readonly logger?: Logger,
  ) {
    this.deployedContractAddress = deployedContract.deployTxData.public.contractAddress;
    providers.privateStateProvider.setContractAddress(this.deployedContractAddress);
    this.state$ = combineLatest([
      providers.publicDataProvider.contractStateObservable(this.deployedContractAddress, { type: 'latest' }).pipe(
        map((contractState) => Voting.ledger(contractState.data)),
        tap((ledgerState) =>
          logger?.trace({
            ledgerStateChanged: {
              state: ledgerState.state,
              candidateAVotes: ledgerState.candidateAVotes,
              candidateBVotes: ledgerState.candidateBVotes,
              totalVotes: ledgerState.totalVotes,
            },
          }),
        ),
      ),
      from(providers.privateStateProvider.get(votingPrivateStateKey) as Promise<VotingPrivateState>),
    ]).pipe(
      map(([ledgerState]) => ({
        state: ledgerState.state,
        proposalTitle: ledgerState.proposalTitle.is_some ? ledgerState.proposalTitle.value : 'No active proposal',
        candidateAVotes: ledgerState.candidateAVotes,
        candidateBVotes: ledgerState.candidateBVotes,
        totalVotes: ledgerState.totalVotes,
      })),
    );
  }

  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<VotingDerivedState>;

  async initialize(title: string): Promise<void> {
    this.logger?.info(`initializingVoting: ${title}`);
    const txData = await this.deployedContract.callTx.initialize(title);
    this.logger?.trace({
      transactionAdded: {
        circuit: 'initialize',
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });
  }

  async vote(choice: number): Promise<void> {
    this.logger?.info(`castingVote: ${choice}`);
    const txData = await this.deployedContract.callTx.vote(BigInt(choice));
    this.logger?.trace({
      transactionAdded: {
        circuit: 'vote',
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });
  }

  async closeVoting(): Promise<void> {
    this.logger?.info('closingVoting');
    const txData = await this.deployedContract.callTx.closeVoting();
    this.logger?.trace({
      transactionAdded: {
        circuit: 'closeVoting',
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });
  }

  static async deploy(providers: VotingProviders, logger?: Logger): Promise<VotingAPI> {
    logger?.info('deployContract');

    const deployedVotingContract = await deployContract(providers, {
      compiledContract: CompiledVotingContractContract,
      privateStateId: votingPrivateStateKey,
      initialPrivateState: createVotingPrivateState(utils.randomBytes(32)),
    });

    logger?.trace({
      contractDeployed: {
        finalizedDeployTxData: deployedVotingContract.deployTxData.public,
      },
    });

    return new VotingAPI(deployedVotingContract, providers, logger);
  }

  static async join(providers: VotingProviders, contractAddress: ContractAddress, logger?: Logger): Promise<VotingAPI> {
    logger?.info({
      joinContract: {
        contractAddress,
      },
    });

    const deployedVotingContract = await findDeployedContract<VotingContract>(providers, {
      contractAddress,
      compiledContract: CompiledVotingContractContract,
      privateStateId: votingPrivateStateKey,
      initialPrivateState: await VotingAPI.getPrivateState(providers, contractAddress),
    });

    logger?.trace({
      contractJoined: {
        finalizedDeployTxData: deployedVotingContract.deployTxData.public,
      },
    });

    return new VotingAPI(deployedVotingContract, providers, logger);
  }

  private static async getPrivateState(
    providers: VotingProviders,
    contractAddress: ContractAddress,
  ): Promise<VotingPrivateState> {
    providers.privateStateProvider.setContractAddress(contractAddress);
    const existingPrivateState = await providers.privateStateProvider.get(votingPrivateStateKey);
    return existingPrivateState ?? createVotingPrivateState(utils.randomBytes(32));
  }
}

export * as utils from './utils/index.js';
export * from './common-types.js';
