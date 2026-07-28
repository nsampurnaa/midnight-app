/*
 * This file defines the shape of the Voting DApp's private state
 * and the witness functions that access it.
 */

import { Ledger } from "./managed/voting/contract/index.js";
import { WitnessContext } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";

export type VotingPrivateState = {
  readonly secretKey: Uint8Array;
};

export const createVotingPrivateState = (secretKey: Uint8Array) => ({
  secretKey,
});

export const witnesses = {
  localSecretKey: ({
    privateState,
  }: WitnessContext<Ledger, VotingPrivateState>): [
    VotingPrivateState,
    Uint8Array,
  ] => [privateState, privateState.secretKey],
};
