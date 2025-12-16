'use client'

import { getClmmProgram, getClmmProgramId } from '@project/anchor'
import { useConnection } from '@solana/wallet-adapter-react'
import { Cluster, Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useCluster } from '../cluster/cluster-data-access'
import { useAnchorProvider } from '../solana/solana-provider'
import { useTransactionToast } from '../use-transaction-toast'
import { toast } from 'sonner'
import { createAssociatedTokenAccount, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import BN from 'bn.js'

interface InitializePoolArgs {
  payerPubkey: PublicKey, 
  TICK_SPACING: number, 
  INITIAL_SQRT_PRICE: BN, 
  tokenMint0: PublicKey, 
  tokenMint1: PublicKey
}

interface OpenPositionArgs {
  payerPubkey: PublicKey, 
  TICK_SPACING: number, 
  LOWER_TICK: number, 
  UPPER_TICK: number, 
  LIQUIDITY_AMOUNT: BN, 
  tokenMint0: PublicKey, 
  tokenMint1: PublicKey, 
  tokenVault0Pubkey: PublicKey, 
  tokenVault1Pubkey: PublicKey
}

interface IncreaseLiquidityArgs {
  payerPubkey: PublicKey, 
  TICK_SPACING: number, 
  LOWER_TICK: number, 
  UPPER_TICK: number, 
  liquidityAmount: BN, 
  tokenMint0: PublicKey, 
  tokenMint1: PublicKey, 
  tokenVault0Pubkey: PublicKey, 
  tokenVault1Pubkey: PublicKey
}

interface DecreaseLiquidityArgs {
  payerPubkey: PublicKey, 
  TICK_SPACING: number, 
  LOWER_TICK: number, 
  UPPER_TICK: number, 
  liquidityToRemove: BN, 
  tokenMint0: PublicKey, 
  tokenMint1: PublicKey, 
  tokenVault0Pubkey: PublicKey, 
  tokenVault1Pubkey: PublicKey
}

interface SwapArgs {
  payerPubkey: PublicKey, 
  TICK_SPACING: number, 
  tokenMint0: PublicKey, 
  tokenMint1: PublicKey, 
  tokenVault0Pubkey: PublicKey, 
  tokenVault1Pubkey: PublicKey, 
  amountIn: BN, 
  swapToken0For1: boolean, 
  amountOutMinimum: BN
}

const TICKS_PER_ARRAY = 30;

function i32ToLeBytes(value: number): Buffer {
  const buffer = Buffer.allocUnsafe(4);
  buffer.writeInt32LE(value, 0);
  return buffer;
}

function getTickArrayStartIndex(tick: number, tickSpacing: number): number {
  const ticksPerArrayI32 = TICKS_PER_ARRAY;
  const arrayIdx = Math.floor(Math.floor(tick / tickSpacing) / ticksPerArrayI32);
  return arrayIdx * ticksPerArrayI32 * tickSpacing;
}

export function useClmmProgram() {
  const { connection } = useConnection()
  const { cluster } = useCluster()
  const transactionToast = useTransactionToast()
  const provider = useAnchorProvider()
  const programId = useMemo(() => getClmmProgramId(cluster.network as Cluster), [cluster])
  const program = useMemo(() => getClmmProgram(provider, programId), [provider, programId])

  const poolAccounts = useQuery({
    queryKey: ['pool', 'all', { cluster }],
    queryFn: () => program.account.pool.all(),
  })

  const positionAccounts = useQuery({
    queryKey: ['position', 'all', { cluster }],
    queryFn: () => program.account.position.all(),
  })

  const tickArrayAccounts = useQuery({
    queryKey: ['tickArray', 'all', { cluster }],
    queryFn: () => program.account.tickArray.all(),
  })

  const getProgramAccount = useQuery({
    queryKey: ['get-program-account', { cluster }],
    queryFn: () => connection.getParsedAccountInfo(programId),
  })

  const initializePoolHandler = useMutation<string, Error, InitializePoolArgs>({
    mutationKey: ['pool', 'initialize', { cluster }],
    mutationFn: async({ payerPubkey, TICK_SPACING, INITIAL_SQRT_PRICE, tokenMint0, tokenMint1 }) => {
      const [poolPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), tokenMint0.toBuffer(), tokenMint1.toBuffer(), i32ToLeBytes(TICK_SPACING)], 
        program.programId
      );
      const tokenVault0Keypair = Keypair.generate();
      const tokenVault1Keypair = Keypair.generate();

      return await program.methods
        .initializePool(TICK_SPACING, INITIAL_SQRT_PRICE)
        .accountsStrict({ 
          payer: payerPubkey,
          pool: poolPDA,
          tokenMint0,
          tokenMint1,
          tokenVault0: tokenVault0Keypair.publicKey,
          tokenVault1: tokenVault1Keypair.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([tokenVault0Keypair, tokenVault1Keypair])
        .rpc()
      },
    onSuccess: async (signature) => {
      transactionToast(signature)
      await poolAccounts.refetch()
    },
    onError: () => {
      toast.error('Failed to initialize pool account')
    },
  })

  const openPositionHandler = useMutation<string, Error, OpenPositionArgs>({
    mutationKey: ['position', 'open', { cluster }],
    mutationFn: async({ payerPubkey, TICK_SPACING, LOWER_TICK, UPPER_TICK, LIQUIDITY_AMOUNT, tokenMint0, tokenMint1, tokenVault0Pubkey, tokenVault1Pubkey }) => {
      const [poolPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), tokenMint0.toBuffer(), tokenMint1.toBuffer(), i32ToLeBytes(TICK_SPACING)], 
        program.programId
      );
      const lowerTickArrayStartIndex = getTickArrayStartIndex(LOWER_TICK, TICK_SPACING);
      const upperTickArrayStartIndex = getTickArrayStartIndex(UPPER_TICK, TICK_SPACING);

      const userTokenAccount0 = await getAssociatedTokenAddress(
        tokenMint0,
        payerPubkey
      )
  
      const userTokenAccount1 = await getAssociatedTokenAddress(
        tokenMint1,
        payerPubkey
      )

      const [lowerTickArrayPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("tick_array"),
          poolPDA.toBuffer(),
          i32ToLeBytes(lowerTickArrayStartIndex), 
        ],
        program.programId
      );
  
      const [upperTickArrayPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("tick_array"),
          poolPDA.toBuffer(),
          i32ToLeBytes(upperTickArrayStartIndex),
        ],
        program.programId
      );
  
      const [positionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("position"),
          payerPubkey.toBuffer(),
          poolPDA.toBuffer(),
          i32ToLeBytes(LOWER_TICK), 
          i32ToLeBytes(UPPER_TICK), 
        ],
        program.programId
      );

      return await program.methods
        .openPosition(
          payerPubkey,
          LOWER_TICK,
          UPPER_TICK,
          LIQUIDITY_AMOUNT,
          lowerTickArrayStartIndex,
          upperTickArrayStartIndex 
        )
        .accountsStrict({ 
          pool: poolPDA,
          lowerTickArray: lowerTickArrayPda,
          upperTickArray: upperTickArrayPda,
          position: positionPda,
          userToken0: userTokenAccount0,
          userToken1: userTokenAccount1,
          poolToken0: tokenVault0Pubkey,
          poolToken1: tokenVault1Pubkey,
          payer: payerPubkey,
          tokenMint0: tokenMint0,
          tokenMint1: tokenMint1,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc()
      },
    onSuccess: async (signature) => {
      transactionToast(signature)
      await poolAccounts.refetch()
      await positionAccounts.refetch()
      await tickArrayAccounts.refetch()
    },
    onError: () => {
      toast.error('Failed to open position account')
    },
  })

  const increaseLiquidityHandler = useMutation<string, Error, IncreaseLiquidityArgs>({
    mutationKey: ['liquidity', 'increase', { cluster }],
    mutationFn: async({ payerPubkey, TICK_SPACING, LOWER_TICK, UPPER_TICK, liquidityAmount, tokenMint0, tokenMint1, tokenVault0Pubkey, tokenVault1Pubkey }) => {
      const [poolPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), tokenMint0.toBuffer(), tokenMint1.toBuffer(), i32ToLeBytes(TICK_SPACING)], 
        program.programId
      );
      const lowerTickArrayStartIndex = getTickArrayStartIndex(LOWER_TICK, TICK_SPACING);
      const upperTickArrayStartIndex = getTickArrayStartIndex(UPPER_TICK, TICK_SPACING);

      const userTokenAccount0 = await getAssociatedTokenAddress(
        tokenMint0,
        payerPubkey
      )
  
      const userTokenAccount1 = await getAssociatedTokenAddress(
        tokenMint1,
        payerPubkey
      )

      const [lowerTickArrayPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("tick_array"),
          poolPDA.toBuffer(),
          i32ToLeBytes(lowerTickArrayStartIndex), 
        ],
        program.programId
      );
  
      const [upperTickArrayPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("tick_array"),
          poolPDA.toBuffer(),
          i32ToLeBytes(upperTickArrayStartIndex),
        ],
        program.programId
      );
  
      const [positionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("position"),
          payerPubkey.toBuffer(),
          poolPDA.toBuffer(),
          i32ToLeBytes(LOWER_TICK), 
          i32ToLeBytes(UPPER_TICK), 
        ],
        program.programId
      );

      return await program.methods
        .increaseLiquidity(liquidityAmount)
        .accountsStrict({ 
          pool: poolPDA,
          lowerTickArray: lowerTickArrayPda,
          upperTickArray: upperTickArrayPda,
          position: positionPda,
          userToken0: userTokenAccount0,
          userToken1: userTokenAccount1,
          poolToken0: tokenVault0Pubkey,
          poolToken1: tokenVault1Pubkey,
          payer: payerPubkey,
          tokenMint0: tokenMint0,
          tokenMint1: tokenMint1,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc()
      },
    onSuccess: async (signature) => {
      transactionToast(signature)
      await poolAccounts.refetch()
      await positionAccounts.refetch()
      await tickArrayAccounts.refetch()
    },
    onError: () => {
      toast.error('Failed to increase liquidity account')
    },
  })

  const decreaseLiquidityHandler = useMutation<string, Error, DecreaseLiquidityArgs>({
    mutationKey: ['liquidity', 'decrease', { cluster }],
    mutationFn: async({ payerPubkey, TICK_SPACING, LOWER_TICK, UPPER_TICK, liquidityToRemove, tokenMint0, tokenMint1, tokenVault0Pubkey, tokenVault1Pubkey }) => {
      const [poolPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), tokenMint0.toBuffer(), tokenMint1.toBuffer(), i32ToLeBytes(TICK_SPACING)], 
        program.programId
      );
      const lowerTickArrayStartIndex = getTickArrayStartIndex(LOWER_TICK, TICK_SPACING);
      const upperTickArrayStartIndex = getTickArrayStartIndex(UPPER_TICK, TICK_SPACING);

      const userTokenAccount0 = await getAssociatedTokenAddress(
        tokenMint0,
        payerPubkey
      )
  
      const userTokenAccount1 = await getAssociatedTokenAddress(
        tokenMint1,
        payerPubkey
      )

      const [lowerTickArrayPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("tick_array"),
          poolPDA.toBuffer(),
          i32ToLeBytes(lowerTickArrayStartIndex), 
        ],
        program.programId
      );
  
      const [upperTickArrayPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("tick_array"),
          poolPDA.toBuffer(),
          i32ToLeBytes(upperTickArrayStartIndex),
        ],
        program.programId
      );
  
      const [positionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("position"),
          payerPubkey.toBuffer(),
          poolPDA.toBuffer(),
          i32ToLeBytes(LOWER_TICK), 
          i32ToLeBytes(UPPER_TICK), 
        ],
        program.programId
      );

      return await program.methods
        .decreaseLiquidity(liquidityToRemove)
        .accountsStrict({ 
          payer: payerPubkey,
          pool: poolPDA,
          lowerTickArray: lowerTickArrayPda,
          upperTickArray: upperTickArrayPda,
          position: positionPda,
          userToken0: userTokenAccount0,
          userToken1: userTokenAccount1,
          poolToken0: tokenVault0Pubkey,
          poolToken1: tokenVault1Pubkey,
          tokenMint0: tokenMint0,
          tokenMint1: tokenMint1,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        // .signers([keypair])
        .rpc()
      },
    onSuccess: async (signature) => {
      transactionToast(signature)
      await poolAccounts.refetch()
      await positionAccounts.refetch()
      await tickArrayAccounts.refetch()
    },
    onError: () => {
      toast.error('Failed to decrease liquidity account')
    },
  })

  const swapHandler = useMutation<string, Error, SwapArgs>({
    mutationKey: ['liquidity', 'swap', { cluster }],
    mutationFn: async({ payerPubkey, TICK_SPACING, tokenMint0, tokenMint1, tokenVault0Pubkey, tokenVault1Pubkey, amountIn, swapToken0For1, amountOutMinimum }) => {
      const [poolPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), tokenMint0.toBuffer(), tokenMint1.toBuffer(), i32ToLeBytes(TICK_SPACING)], 
        program.programId
      );

      const userTokenAccount0 = await getAssociatedTokenAddress(
        tokenMint0,
        payerPubkey
      )
  
      const userTokenAccount1 = await getAssociatedTokenAddress(
        tokenMint1,
        payerPubkey
      )

      return await program.methods
        .swap(amountIn, swapToken0For1, amountOutMinimum)
        .accountsStrict({ 
          pool: poolPDA,
          userToken0: userTokenAccount0,
          userToken1: userTokenAccount1,
          poolToken0: tokenVault0Pubkey,
          poolToken1: tokenVault1Pubkey,
          payer: payerPubkey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc()
      },
    onSuccess: async (signature) => {
      transactionToast(signature)
      await poolAccounts.refetch()
    },
    onError: () => {
      toast.error('Failed to swap')
    },
  })

  return {
    program,
    programId,
    poolAccounts,
    positionAccounts,
    tickArrayAccounts,
    getProgramAccount,
    initializePoolHandler,
    openPositionHandler,
    increaseLiquidityHandler,
    decreaseLiquidityHandler,
    swapHandler
  }
}

export function useClmmProgramAccount({ account }: { account: PublicKey }) {
  const { cluster } = useCluster()
  const transactionToast = useTransactionToast()
  const { program, poolAccounts, positionAccounts, tickArrayAccounts } = useClmmProgram()

  const poolAccountQuery = useQuery({
    queryKey: ['pool', 'fetch', { cluster, account }],
    queryFn: () => program.account.pool.fetch(account),
  })

  const positionAccountQuery = useQuery({
    queryKey: ['position', 'fetch', { cluster, account }],
    queryFn: () => program.account.position.fetch(account),
  })

  const tickArrayAccountQuery = useQuery({
    queryKey: ['tickArray', 'fetch', { cluster, account }],
    queryFn: () => program.account.tickArray.fetch(account),
  })

  // const closeMutation = useMutation({
  //   mutationKey: ['counter', 'close', { cluster, account }],
  //   mutationFn: () => program.methods.close().accounts({ counter: account }).rpc(),
  //   onSuccess: async (tx) => {
  //     transactionToast(tx)
  //     await accounts.refetch()
  //   },
  // })

  // const decrementMutation = useMutation({
  //   mutationKey: ['counter', 'decrement', { cluster, account }],
  //   mutationFn: () => program.methods.decrement().accounts({ counter: account }).rpc(),
  //   onSuccess: async (tx) => {
  //     transactionToast(tx)
  //     await accountQuery.refetch()
  //   },
  // })

  // const incrementMutation = useMutation({
  //   mutationKey: ['counter', 'increment', { cluster, account }],
  //   mutationFn: () => program.methods.increment().accounts({ counter: account }).rpc(),
  //   onSuccess: async (tx) => {
  //     transactionToast(tx)
  //     await accountQuery.refetch()
  //   },
  // })

  // const setMutation = useMutation({
  //   mutationKey: ['counter', 'set', { cluster, account }],
  //   mutationFn: (value: number) => program.methods.set(value).accounts({ counter: account }).rpc(),
  //   onSuccess: async (tx) => {
  //     transactionToast(tx)
  //     await accountQuery.refetch()
  //   },
  // })

  return {
    poolAccountQuery,
    positionAccountQuery,
    tickArrayAccountQuery,
    // closeMutation,
    // decrementMutation,
    // incrementMutation,
    // setMutation,
  }
}
