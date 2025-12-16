import * as anchor from '@coral-xyz/anchor'
import { Program } from '@coral-xyz/anchor'
import { Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import { Clmm } from '../target/types/clmm'
import { BN } from 'bn.js'
import { createAssociatedTokenAccount, createMint, getAccount, mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";

describe('Clmm', () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)
  const payer = provider.wallet as anchor.Wallet

  const program = anchor.workspace.Clmm as Program<Clmm>

  const TICK_SPACING = 60;
  const INITIAL_SQRT_PRICE = new BN("79228162514264337593543950336"); // sqrt(1) * 2^96
  const TICKS_PER_ARRAY = 30;
  const LOWER_TICK = 0;
  const UPPER_TICK = 1800;
  const LIQUIDITY_AMOUNT = new BN(100000);

  let tokenMint0: PublicKey;
  let tokenMint1: PublicKey;
  let poolPDA: PublicKey;
  let tokenVault0Keypair: Keypair;
  let tokenVault1Keypair: Keypair;
  let userTokenAccount0: PublicKey;
  let userTokenAccount1: PublicKey;
  let positionPda: PublicKey;
  let lowerTickArrayPda: PublicKey;
  let upperTickArrayPda: PublicKey;

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

  beforeAll(async() => {
    // Create token mints
    tokenMint0 = await createMint(
      provider.connection,
      payer.payer,
      payer.publicKey,
      null, 
      6
    );

    tokenMint1 = await createMint(
      provider.connection,
      payer.payer,
      payer.publicKey,
      null, 
      6
    );

    // Derive pool PDA
    [poolPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), tokenMint0.toBuffer(), tokenMint1.toBuffer(), i32ToLeBytes(TICK_SPACING)], 
      program.programId
    );

    // Generate token vault keypairs
    tokenVault0Keypair = Keypair.generate();
    tokenVault1Keypair = Keypair.generate();

    // Create user token accounts
    userTokenAccount0 = await createAssociatedTokenAccount(
      provider.connection,
      payer.payer,
      tokenMint0,
      payer.publicKey
    );

    userTokenAccount1 = await createAssociatedTokenAccount(
      provider.connection,
      payer.payer,
      tokenMint1,
      payer.publicKey
    );

    // Mint tokens to user accounts
    await mintTo(
      provider.connection,
      payer.payer,
      tokenMint0,
      userTokenAccount0,
      payer.publicKey,
      1000000000
    );

    await mintTo(
      provider.connection,
      payer.payer,
      tokenMint1,
      userTokenAccount1,
      payer.publicKey,
      1000000000
    );

    // Derive tick array and position PDAs
    const lowerTickArrayStartIndex = getTickArrayStartIndex(LOWER_TICK, TICK_SPACING);
    const upperTickArrayStartIndex = getTickArrayStartIndex(UPPER_TICK, TICK_SPACING);

    [lowerTickArrayPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("tick_array"),
        poolPDA.toBuffer(),
        i32ToLeBytes(lowerTickArrayStartIndex), 
      ],
      program.programId
    );

    [upperTickArrayPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("tick_array"),
        poolPDA.toBuffer(),
        i32ToLeBytes(upperTickArrayStartIndex),
      ],
      program.programId
    );

    [positionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("position"),
        payer.publicKey.toBuffer(),
        poolPDA.toBuffer(),
        i32ToLeBytes(LOWER_TICK), 
        i32ToLeBytes(UPPER_TICK), 
      ],
      program.programId
    );
  })

  it('Initialize Pool', async () => {
    const tx = await program.methods
      .initializePool(TICK_SPACING, INITIAL_SQRT_PRICE)
      .accountsStrict({
        payer: payer.publicKey,
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

      console.log("initPool tx: ", tx);

    const poolAccount = await program.account.pool.fetch(poolPDA);
    console.log("PoolPda: ", poolPDA.toBase58());
    console.log("tokenMint0: ", tokenMint0.toBase58());
    console.log("tokenMint1: ", tokenMint1.toBase58());
    console.log("tokenVault0: ", tokenVault0Keypair.publicKey.toBase58());
    console.log("tokenVault1: ", tokenVault1Keypair.publicKey.toBase58());

    expect(poolAccount.tickSpacing).toEqual(TICK_SPACING);
    expect(poolAccount.tokenMint0.toString()).toEqual(tokenMint0.toString());
    expect(poolAccount.tokenMint1.toString()).toEqual(tokenMint1.toString());
    expect(poolAccount.globalLiquidity.toNumber()).toEqual(0);
    expect(poolAccount.sqrtPriceX96.toString()).toEqual(INITIAL_SQRT_PRICE.toString());
  })

  it('Open Position in pool', async () => {
    const lowerTickArrayStartIndex = getTickArrayStartIndex(LOWER_TICK, TICK_SPACING);
    const upperTickArrayStartIndex = getTickArrayStartIndex(UPPER_TICK, TICK_SPACING);

    const userToken0Before = await getAccount(
      provider.connection,
      userTokenAccount0
    );
    const userToken1Before = await getAccount(
      provider.connection,
      userTokenAccount1
    );

    console.log("lowerTickArrayPda: ", lowerTickArrayPda)
    console.log("upperTickArrayPda: ", upperTickArrayPda)
    console.log("Position :", positionPda.toBase58());

    const tx = await program.methods
      .openPosition(
        payer.publicKey,
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
        poolToken0: tokenVault0Keypair.publicKey,
        poolToken1: tokenVault1Keypair.publicKey,
        payer: payer.publicKey,
        tokenMint0: tokenMint0,
        tokenMint1: tokenMint1,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc({ skipPreflight: true })

      console.log("openPosition tx:", tx);

    // Verify position was created
    const positionAccount = await program.account.position.fetch(positionPda);
    expect(positionAccount.liquidity.toString()).toEqual(LIQUIDITY_AMOUNT.toString());
    expect(positionAccount.tickLower).toEqual(LOWER_TICK);
    expect(positionAccount.tickUpper).toEqual(UPPER_TICK);
    expect(positionAccount.owner.toString()).toEqual(payer.publicKey.toString());

    // Verify pool liquidity increased
    const poolAccount = await program.account.pool.fetch(poolPDA);
    expect(poolAccount.globalLiquidity.toString()).toEqual(LIQUIDITY_AMOUNT.toString());

    // Verify tokens were transferred (with simplified calculation: liquidity/1000)
    const userToken0After = await getAccount(provider.connection, userTokenAccount0);
    const userToken1After = await getAccount(provider.connection, userTokenAccount1);

    const expectedAmount = LIQUIDITY_AMOUNT.toNumber() / 1000;
    
    expect(Number(userToken0After.amount)).toEqual(Number(userToken0Before.amount) - expectedAmount);
    expect(Number(userToken1After.amount)).toEqual(Number(userToken1Before.amount) - expectedAmount);
  })

  it('Increase Liquidity', async () => {
    const additionalLiquidity = new BN(50000);

    const userToken0Before = await getAccount(provider.connection, userTokenAccount0);
    const userToken1Before = await getAccount(provider.connection, userTokenAccount1);
    const positionBefore = await program.account.position.fetch(positionPda);

    const tx = await program.methods
      .increaseLiquidity(additionalLiquidity)
      .accountsStrict({
        pool: poolPDA,
        lowerTickArray: lowerTickArrayPda,
        upperTickArray: upperTickArrayPda,
        position: positionPda,
        userToken0: userTokenAccount0,
        userToken1: userTokenAccount1,
        poolToken0: tokenVault0Keypair.publicKey,
        poolToken1: tokenVault1Keypair.publicKey,
        payer: payer.publicKey,
        tokenMint0: tokenMint0,
        tokenMint1: tokenMint1,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc({ skipPreflight: true })

      console.log("increase liquidity tx:", tx);

    // Verify position liquidity increased
    const positionAfter = await program.account.position.fetch(positionPda);
    expect(positionAfter.liquidity.toString()).toEqual(
      positionBefore.liquidity.add(additionalLiquidity).toString()
    );

    // Verify pool liquidity increased
    const poolAccount = await program.account.pool.fetch(poolPDA);
    expect(poolAccount.globalLiquidity.toString()).toEqual(
      LIQUIDITY_AMOUNT.add(additionalLiquidity).toString()
    );

    // Verify tokens were transferred
    const userToken0After = await getAccount(provider.connection, userTokenAccount0);
    const userToken1After = await getAccount(provider.connection, userTokenAccount1);

    const expectedAmount = additionalLiquidity.toNumber() / 1000;

    expect(Number(userToken0After.amount)).toEqual(Number(userToken0Before.amount) - expectedAmount);
    expect(Number(userToken1After.amount)).toEqual(Number(userToken1Before.amount) - expectedAmount);
  })

  it('Swap token 0 for token 1', async () => {
    // Use a smaller amount that the pool can handle
    // Pool has 150 tokens of each (100 + 50 from liquidity)
    const amountIn = new BN(50);
    const amountOutMinimum = new BN(45);
    const swapToken0For1 = true;

    const userToken0Before = await getAccount(provider.connection, userTokenAccount0);
    const userToken1Before = await getAccount(provider.connection, userTokenAccount1);
    const poolBefore = await program.account.pool.fetch(poolPDA);

    const tx = await program.methods
      .swap(amountIn, swapToken0For1, amountOutMinimum)
      .accountsStrict({
        pool: poolPDA,
        userToken0: userTokenAccount0,
        userToken1: userTokenAccount1,
        poolToken0: tokenVault0Keypair.publicKey,
        poolToken1: tokenVault1Keypair.publicKey,
        payer: payer.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc({ skipPreflight: true })

      console.log("swap tx:", tx);

    // Verify tokens were swapped
    const userToken0After = await getAccount(provider.connection, userTokenAccount0);
    const userToken1After = await getAccount(provider.connection, userTokenAccount1);

    // With 0.1% fee: output = input - input/1000
    const expectedOutput = amountIn.toNumber() - Math.floor(amountIn.toNumber() / 1000);

    expect(Number(userToken0After.amount)).toEqual(Number(userToken0Before.amount) - amountIn.toNumber());
    expect(Number(userToken1After.amount)).toEqual(Number(userToken1Before.amount) + expectedOutput);

    // Verify pool price changed
    const poolAfter = await program.account.pool.fetch(poolPDA);
    expect(poolAfter.sqrtPriceX96.toString()).not.toEqual(poolBefore.sqrtPriceX96.toString());
    console.log("Price before:", poolBefore.sqrtPriceX96.toString());
    console.log("Price after:", poolAfter.sqrtPriceX96.toString());
  })

  it('Swap token 1 for token 0', async () => {
    const amountIn = new BN(50);
    const amountOutMinimum = new BN(45);
    const swapToken0For1 = false;

    const userToken0Before = await getAccount(provider.connection, userTokenAccount0);
    const userToken1Before = await getAccount(provider.connection, userTokenAccount1);

    const tx = await program.methods
      .swap(amountIn, swapToken0For1, amountOutMinimum)
      .accountsStrict({
        pool: poolPDA,
        userToken0: userTokenAccount0,
        userToken1: userTokenAccount1,
        poolToken0: tokenVault0Keypair.publicKey,
        poolToken1: tokenVault1Keypair.publicKey,
        payer: payer.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc({ skipPreflight: true })

      console.log("swap2 tx:", tx);

    // Verify tokens were swapped
    const userToken0After = await getAccount(provider.connection, userTokenAccount0);
    const userToken1After = await getAccount(provider.connection, userTokenAccount1);

    const expectedOutput = amountIn.toNumber() - Math.floor(amountIn.toNumber() / 1000);

    expect(Number(userToken1After.amount)).toEqual(Number(userToken1Before.amount) - amountIn.toNumber());
    expect(Number(userToken0After.amount)).toEqual(Number(userToken0Before.amount) + expectedOutput);
  })

  it('Decrease Liquidity', async () => {
    const liquidityToRemove = new BN(50000);

    const userToken0Before = await getAccount(provider.connection, userTokenAccount0);
    const userToken1Before = await getAccount(provider.connection, userTokenAccount1);
    const positionBefore = await program.account.position.fetch(positionPda);
    const poolBefore = await program.account.pool.fetch(poolPDA);

    const tx = await program.methods
      .decreaseLiquidity(liquidityToRemove)
      .accountsStrict({
        payer: payer.publicKey,
        pool: poolPDA,
        lowerTickArray: lowerTickArrayPda,
        upperTickArray: upperTickArrayPda,
        position: positionPda,
        userToken0: userTokenAccount0,
        userToken1: userTokenAccount1,
        poolToken0: tokenVault0Keypair.publicKey,
        poolToken1: tokenVault1Keypair.publicKey,
        tokenMint0: tokenMint0,
        tokenMint1: tokenMint1,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc({ skipPreflight: true })

      console.log("decrease liquidity tx:", tx);

    // Verify position liquidity decreased
    const positionAfter = await program.account.position.fetch(positionPda);
    expect(positionAfter.liquidity.toString()).toEqual(
      positionBefore.liquidity.sub(liquidityToRemove).toString()
    );

    // Verify pool liquidity decreased
    const poolAfter = await program.account.pool.fetch(poolPDA);
    expect(poolAfter.globalLiquidity.toString()).toEqual(
      poolBefore.globalLiquidity.sub(liquidityToRemove).toString()
    );

    // Verify tokens were returned
    const userToken0After = await getAccount(provider.connection, userTokenAccount0);
    const userToken1After = await getAccount(provider.connection, userTokenAccount1);

    const expectedAmount = liquidityToRemove.toNumber() / 1000;

    expect(Number(userToken0After.amount)).toEqual(Number(userToken0Before.amount) + expectedAmount);
    expect(Number(userToken1After.amount)).toEqual(Number(userToken1Before.amount) + expectedAmount);
  })

  it('Fails to swap with insufficient liquidity', async () => {
    const amountIn = new BN(100000000000); // Very large amount
    const amountOutMinimum = new BN(1);
    const swapToken0For1 = true;

    try {
      await program.methods
        .swap(amountIn, swapToken0For1, amountOutMinimum)
        .accountsStrict({
          pool: poolPDA,
          userToken0: userTokenAccount0,
          userToken1: userTokenAccount1,
          poolToken0: tokenVault0Keypair.publicKey,
          poolToken1: tokenVault1Keypair.publicKey,
          payer: payer.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc()
      
      // If we reach here, test should fail
      expect(true).toBe(false);
    } catch (error) {
      // Expected to fail due to insufficient tokens
      console.log("Expected error:", error.message || error);
      expect(error).toBeDefined();
    }
  })

  it('Fails to open position with invalid tick range', async () => {
    const invalidLowerTick = 5000;
    const invalidUpperTick = 1000; // Upper < Lower

    const lowerTickArrayStartIndex = getTickArrayStartIndex(invalidLowerTick, TICK_SPACING);
    const upperTickArrayStartIndex = getTickArrayStartIndex(invalidUpperTick, TICK_SPACING);

    const [invalidLowerTickArrayPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("tick_array"),
        poolPDA.toBuffer(),
        i32ToLeBytes(lowerTickArrayStartIndex), 
      ],
      program.programId
    );

    const [invalidUpperTickArrayPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("tick_array"),
        poolPDA.toBuffer(),
        i32ToLeBytes(upperTickArrayStartIndex),
      ],
      program.programId
    );

    const [invalidPositionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("position"),
        payer.publicKey.toBuffer(),
        poolPDA.toBuffer(),
        i32ToLeBytes(invalidLowerTick), 
        i32ToLeBytes(invalidUpperTick), 
      ],
      program.programId
    );

    try {
      await program.methods
        .openPosition(
          payer.publicKey,
          invalidLowerTick,
          invalidUpperTick,
          LIQUIDITY_AMOUNT,
          lowerTickArrayStartIndex,
          upperTickArrayStartIndex 
        )
        .accountsStrict({ 
          pool: poolPDA,
          lowerTickArray: invalidLowerTickArrayPda,
          upperTickArray: invalidUpperTickArrayPda,
          position: invalidPositionPda,
          userToken0: userTokenAccount0,
          userToken1: userTokenAccount1,
          poolToken0: tokenVault0Keypair.publicKey,
          poolToken1: tokenVault1Keypair.publicKey,
          payer: payer.publicKey,
          tokenMint0: tokenMint0,
          tokenMint1: tokenMint1,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc()

      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      // Expected to fail
      console.log("Expected error:", error.message || error);
      expect(error).toBeDefined();
    }
  })
})