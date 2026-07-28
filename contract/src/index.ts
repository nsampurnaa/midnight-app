import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";

export * from "./managed/voting/contract/index.js";
export * from "./witnesses.js";

import * as CompiledVotingContract from "./managed/voting/contract/index.js";
import * as Witnesses from "./witnesses.js";

export const CompiledVotingContractContract = CompiledContract.make<
  CompiledVotingContract.Contract<Witnesses.VotingPrivateState>
>("Voting", CompiledVotingContract.Contract<Witnesses.VotingPrivateState>).pipe(
  CompiledContract.withWitnesses(Witnesses.witnesses),
  CompiledContract.withCompiledFileAssets("./managed/voting"),
);
