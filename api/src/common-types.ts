import { type MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import { type FoundContract } from '@midnight-ntwrk/midnight-js-contracts';
import type { State, VotingPrivateState, Contract, Witnesses } from '../../contract/src/index.js';

export const votingPrivateStateKey = 'votingPrivateState';
export type PrivateStateId = typeof votingPrivateStateKey;

export type PrivateStates = {
  readonly votingPrivateState: VotingPrivateState;
};

export type VotingContract = Contract<VotingPrivateState, Witnesses<VotingPrivateState>>;

export type VotingCircuitKeys = Exclude<keyof VotingContract['impureCircuits'], number | symbol>;

export type VotingProviders = MidnightProviders<VotingCircuitKeys, PrivateStateId, VotingPrivateState>;

export type DeployedVotingContract = FoundContract<VotingContract>;

export type VotingDerivedState = {
  readonly state: State;
  readonly proposalTitle: string;
  readonly candidateAVotes: bigint;
  readonly candidateBVotes: bigint;
  readonly totalVotes: bigint;
};
