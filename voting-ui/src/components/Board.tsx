import React, { useCallback, useEffect, useState } from 'react';
import { type ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import {
  Backdrop,
  CircularProgress,
  Card,
  CardContent,
  CardHeader,
  IconButton,
  Skeleton,
  Typography,
  TextField,
  Button,
  Box,
  LinearProgress,
  Chip,
  Alert,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import CopyIcon from '@mui/icons-material/ContentPasteOutlined';
import StopIcon from '@mui/icons-material/HighlightOffOutlined';
import SecurityIcon from '@mui/icons-material/Security';
import { type VotingDerivedState, type DeployedVotingAPI } from '../../../api/src/index.js';
import { useDeployedBoardContext } from '../hooks/index.js';
import { type BoardDeployment } from '../contexts/index.js';
import { type Observable } from 'rxjs';
import { State } from '../../../contract/src/index.js';
import { EmptyCardContent } from './Board.EmptyCardContent.js';

export const CONTRACT_ADDRESS_PLACEHOLDER = "<YOUR_DEPLOYED_CONTRACT_ADDRESS>";

export interface BoardProps {
  boardDeployment$?: Observable<BoardDeployment>;
}

export const Board: React.FC<Readonly<BoardProps>> = ({ boardDeployment$ }) => {
  const boardApiProvider = useDeployedBoardContext();
  const [boardDeployment, setBoardDeployment] = useState<BoardDeployment>();
  const [deployedVotingAPI, setDeployedVotingAPI] = useState<DeployedVotingAPI>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [votingState, setVotingState] = useState<VotingDerivedState>();
  const [proposalInput, setProposalInput] = useState<string>('');
  const [isWorking, setIsWorking] = useState(!!boardDeployment$);

  const onCreateBoard = useCallback(() => boardApiProvider.resolve(), [boardApiProvider]);
  const onJoinBoard = useCallback(
    (contractAddress: ContractAddress) => boardApiProvider.resolve(contractAddress),
    [boardApiProvider],
  );

  const onInitialize = useCallback(async () => {
    if (!proposalInput || !deployedVotingAPI) return;
    try {
      setIsWorking(true);
      await deployedVotingAPI.initialize(proposalInput);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsWorking(false);
    }
  }, [deployedVotingAPI, proposalInput]);

  const onVote = useCallback(
    async (choice: number) => {
      if (!deployedVotingAPI) return;
      try {
        setIsWorking(true);
        await deployedVotingAPI.vote(choice);
      } catch (error: unknown) {
        setErrorMessage(error instanceof Error ? error.message : String(error));
      } finally {
        setIsWorking(false);
      }
    },
    [deployedVotingAPI],
  );

  const onCloseVoting = useCallback(async () => {
    if (!deployedVotingAPI) return;
    try {
      setIsWorking(true);
      await deployedVotingAPI.closeVoting();
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsWorking(false);
    }
  }, [deployedVotingAPI]);

  const onCopyContractAddress = useCallback(async () => {
    const addr = deployedVotingAPI?.deployedContractAddress || CONTRACT_ADDRESS_PLACEHOLDER;
    await navigator.clipboard.writeText(addr);
  }, [deployedVotingAPI]);

  useEffect(() => {
    if (!boardDeployment$) return;
    const subscription = boardDeployment$.subscribe(setBoardDeployment);
    return () => subscription.unsubscribe();
  }, [boardDeployment$]);

  useEffect(() => {
    if (!boardDeployment || boardDeployment.status === 'in-progress') return;
    setIsWorking(false);

    if (boardDeployment.status === 'failed') {
      setErrorMessage(
        boardDeployment.error.message.length ? boardDeployment.error.message : 'Encountered an unexpected error.',
      );
      return;
    }

    setDeployedVotingAPI(boardDeployment.api);
    const subscription = boardDeployment.api.state$.subscribe(setVotingState);
    return () => subscription.unsubscribe();
  }, [boardDeployment]);

  const total = Number(votingState?.totalVotes ?? 0n);
  const candidateA = Number(votingState?.candidateAVotes ?? 0n);
  const candidateB = Number(votingState?.candidateBVotes ?? 0n);
  const percentA = total > 0 ? Math.round((candidateA / total) * 100) : 0;
  const percentB = total > 0 ? Math.round((candidateB / total) * 100) : 0;

  return (
    <Card sx={{ position: 'relative', width: 450, minHeight: 480, p: 2, borderRadius: 3, boxShadow: 6 }}>
      {!boardDeployment$ && (
        <EmptyCardContent onCreateBoardCallback={onCreateBoard} onJoinBoardCallback={onJoinBoard} />
      )}

      {boardDeployment$ && (
        <React.Fragment>
          <Backdrop
            sx={{ position: 'absolute', color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1, borderRadius: 3 }}
            open={isWorking}
          >
            <CircularProgress data-testid="board-working-indicator" />
          </Backdrop>
          <Backdrop
            sx={{ position: 'absolute', color: '#ff1744', zIndex: (theme) => theme.zIndex.drawer + 1, p: 2, borderRadius: 3 }}
            open={!!errorMessage}
          >
            <StopIcon fontSize="large" />
            <Typography component="div" data-testid="board-error-message" sx={{ ml: 1, fontWeight: 'bold' }}>
              {errorMessage}
            </Typography>
          </Backdrop>

          <CardHeader
            avatar={<HowToVoteIcon color="primary" fontSize="large" />}
            title={
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                Midnight ZK Voting DApp
              </Typography>
            }
            subheader={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                <Chip
                  icon={<SecurityIcon />}
                  label="Zero-Knowledge Private Voting"
                  size="small"
                  color="secondary"
                  variant="outlined"
                />
                <IconButton size="small" title="Copy Contract Address" onClick={onCopyContractAddress}>
                  <CopyIcon fontSize="small" />
                </IconButton>
              </Box>
            }
          />

          <CardContent>
            {votingState ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {votingState.state === State.UNINITIALIZED && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Alert severity="info">Voting session is uninitialized. Start a new proposal below!</Alert>
                    <TextField
                      label="Proposal Title / Question"
                      variant="outlined"
                      fullWidth
                      value={proposalInput}
                      onChange={(e) => setProposalInput(e.target.value)}
                      placeholder="e.g. Should we approve Proposal #42?"
                    />
                    <Button variant="contained" color="primary" onClick={onInitialize} disabled={!proposalInput.trim()}>
                      Initialize Voting Proposal
                    </Button>
                  </Box>
                )}

                {votingState.state === State.VOTING_OPEN && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }} color="primary">
                      {votingState.proposalTitle}
                    </Typography>

                    <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 2, bgcolor: '#f9f9f9' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>Option A (Candidate A)</Typography>
                        <Typography variant="body2">{candidateA} votes ({percentA}%)</Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={percentA} sx={{ height: 10, borderRadius: 5, mb: 1.5 }} />
                      <Button variant="contained" color="primary" fullWidth onClick={() => onVote(0)}>
                        Cast Private Vote for Option A
                      </Button>
                    </Box>

                    <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 2, bgcolor: '#f9f9f9' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>Option B (Candidate B)</Typography>
                        <Typography variant="body2">{candidateB} votes ({percentB}%)</Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={percentB} color="secondary" sx={{ height: 10, borderRadius: 5, mb: 1.5 }} />
                      <Button variant="contained" color="secondary" fullWidth onClick={() => onVote(1)}>
                        Cast Private Vote for Option B
                      </Button>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Total Cast Votes: {total}
                      </Typography>
                      <Button variant="outlined" color="error" size="small" startIcon={<LockIcon />} onClick={onCloseVoting}>
                        Close Voting
                      </Button>
                    </Box>
                  </Box>
                )}

                {votingState.state === State.VOTING_CLOSED && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Alert severity="warning">Voting session is closed. Final Results:</Alert>
                    <Typography variant="h6">{votingState.proposalTitle}</Typography>

                    <Box>
                      <Typography variant="body2">Candidate A: {candidateA} votes ({percentA}%)</Typography>
                      <LinearProgress variant="determinate" value={percentA} sx={{ height: 10, borderRadius: 5, my: 1 }} />
                    </Box>
                    <Box>
                      <Typography variant="body2">Candidate B: {candidateB} votes ({percentB}%)</Typography>
                      <LinearProgress variant="determinate" value={percentB} color="secondary" sx={{ height: 10, borderRadius: 5, my: 1 }} />
                    </Box>
                    <Typography variant="subtitle2" sx={{ textAlign: 'center', fontWeight: 'bold', mt: 1 }}>
                      Winner: {candidateA > candidateB ? 'Option A' : candidateB > candidateA ? 'Option B' : 'Tie!'}
                    </Typography>
                  </Box>
                )}
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Skeleton variant="rectangular" height={100} />
                <Skeleton variant="rectangular" height={100} />
              </Box>
            )}
          </CardContent>
        </React.Fragment>
      )}
    </Card>
  );
};
