"use client"

import React, { useState } from 'react';
import { Connection, Keypair, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { 
  createInitializeMintInstruction, 
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletButton } from '@/components/solana/solana-provider';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const ADMIN_PUBKEY = new PublicKey("GToMxgF4JcNn8dmNiHt2JrrvLaW6S1zSPoL2W8K2Wkmi");

const TokenCreator = () => {
  const { publicKey, wallet, signTransaction } = useWallet();
  const { connection } = useConnection();
  const route = useRouter();
  const [network, setNetwork] = useState('devnet');
  
  // Form states
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [decimals, setDecimals] = useState(6);
  const [initialSupply, setInitialSupply] = useState('');
  
  // Result states
  const [createdMint, setCreatedMint] = useState('');
  const [createdATA, setCreatedATA] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  // Create token
  const createToken = async () => {
    if (!wallet || !connection || !publicKey || !signTransaction) {
      setError('Please connect your wallet first');
      return;
    }

    if (!tokenName || !tokenSymbol || !initialSupply) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setStatus('Creating token mint...');
    setError('');

    try {
      // Generate new mint keypair
      const mintKeypair = Keypair.generate();
      setCreatedMint(mintKeypair.publicKey.toString());

      // Get minimum lamports for rent exemption
      const lamports = await getMinimumBalanceForRentExemptMint(connection);

      // Get associated token account address
      const associatedToken = await getAssociatedTokenAddress(
        mintKeypair.publicKey,
        publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      setCreatedATA(associatedToken.toString());

      // Create transaction
      const transaction = new Transaction().add(
        // Create mint account
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          space: MINT_SIZE,
          lamports,
          programId: TOKEN_PROGRAM_ID,
        }),
        // Initialize mint
        createInitializeMintInstruction(
          mintKeypair.publicKey,
          decimals,
          publicKey, // mint authority
          publicKey, // freeze authority
          TOKEN_PROGRAM_ID
        ),
        // Create associated token account
        createAssociatedTokenAccountInstruction(
          publicKey, // payer
          associatedToken, // associated token address
          publicKey, // owner
          mintKeypair.publicKey, // mint
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        ),
        // Mint tokens to the associated token account
        createMintToInstruction(
          mintKeypair.publicKey,
          associatedToken,
          publicKey,
          BigInt(parseFloat(initialSupply) * Math.pow(10, decimals)),
          [],
          TOKEN_PROGRAM_ID
        )
      );

      // Get recent blockhash
      setStatus('Getting recent blockhash...');
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Sign transaction
      setStatus('Signing transaction...');
      transaction.partialSign(mintKeypair);
      
      const signed = await signTransaction(transaction);

      // Send transaction
      setStatus('Sending transaction...');
      const signature = await connection.sendRawTransaction(signed.serialize());

      // Confirm transaction
      setStatus('Confirming transaction...');
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      });

      setStatus(`Token created successfully! 🎉`);
      setError('');
    } catch (err) {
      console.error('Error creating token:', err);
      setError(`Failed to create token: ${err}`);
      setStatus('');
    } finally {
      setLoading(false);
    }
  };

  // Request airdrop
  const requestAirdrop = async () => {
    if (!wallet || !connection || !publicKey) {
      setError('Please connect your wallet first');
      return;
    }

    try {
      setStatus('Requesting airdrop...');
      const signature = await connection.requestAirdrop(publicKey, 2 * 1e9); // 2 SOL
      await connection.confirmTransaction(signature);
      setStatus('Airdrop successful! You received 2 SOL');
      setError('');
    } catch (err) {
      setError(`Airdrop failed: ${err}`);
      setStatus('');
    }
  };

  if (!publicKey?.equals(ADMIN_PUBKEY)) {
    return route.push("/");
  }

  return (
    <div className="min-h-screen bg-black p-8 font-mono">
      <div className="max-w-3xl mx-auto">
        <div className="bg-zinc-900 border-2 border-white rounded-2xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">
              TOKEN CREATOR
            </h1>
            <p className="text-gray-400">Create SPL tokens on Solana</p>
          </div>

          <div className='flex justify-between p-2 mb-6'>
            <Link href={"/"} className='bg-red-500 text-white rounded-xl px-5 py-2 hover:bg-red-600 transition-colors font-bold'>
              ← BACK
            </Link>
            <div className='flex justify-center'>
              <WalletButton />
            </div>
          </div>

          {/* Airdrop Button (Devnet only) */}
          {wallet && network === 'devnet' && (
            <button
              onClick={requestAirdrop}
              disabled={loading}
              className="w-full bg-green-500 text-black font-bold py-3 px-6 rounded-lg hover:bg-green-400 transition-all mb-6 disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              💰 REQUEST 2 SOL AIRDROP (DEVNET)
            </button>
          )}

          {/* Token Creation Form */}
          {wallet && (
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  TOKEN NAME
                </label>
                <input
                  type="text"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  placeholder="e.g., My Awesome Token"
                  className="w-full px-4 py-3 bg-zinc-800 border-2 border-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-white placeholder-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  TOKEN SYMBOL
                </label>
                <input
                  type="text"
                  value={tokenSymbol}
                  onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                  placeholder="e.g., MAT"
                  className="w-full px-4 py-3 bg-zinc-800 border-2 border-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-white placeholder-gray-500 uppercase"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  DECIMALS
                </label>
                <select
                  value={decimals}
                  onChange={(e) => setDecimals(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-zinc-800 border-2 border-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-white"
                >
                  <option value={0}>0 (NFT-like)</option>
                  <option value={2}>2</option>
                  <option value={6}>6 (USDC standard)</option>
                  <option value={8}>8 (BTC standard)</option>
                  <option value={9}>9 (SOL standard)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Decimals determine how divisible your token is
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  INITIAL SUPPLY
                </label>
                <input
                  type="number"
                  value={initialSupply}
                  onChange={(e) => setInitialSupply(e.target.value)}
                  placeholder="e.g., 1000000"
                  className="w-full px-4 py-3 bg-zinc-800 border-2 border-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-white placeholder-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  The number of tokens to mint initially (in human-readable format)
                </p>
              </div>

              <button
                onClick={createToken}
                disabled={loading || !tokenName || !tokenSymbol || !initialSupply}
                className="w-full bg-green-500 text-black font-bold py-4 px-6 rounded-lg hover:bg-green-400 transition-all transform hover:scale-105 shadow-lg disabled:bg-gray-600 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? '⏳ CREATING TOKEN...' : '🚀 CREATE TOKEN'}
              </button>
            </div>
          )}

          {/* Status Messages */}
          {status && (
            <div className="mb-4 p-4 bg-green-500/20 border-2 border-green-500 rounded-lg">
              <p className="text-sm font-semibold text-green-500">{status}</p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-4 bg-red-500/20 border-2 border-red-500 rounded-lg">
              <p className="text-sm font-semibold text-red-500">{error}</p>
            </div>
          )}

          {/* Results */}
          {createdMint && (
            <div className="space-y-4 p-6 bg-black border-2 border-green-500 rounded-lg">
              <h3 className="text-xl font-bold text-green-500 mb-4">
                ✅ TOKEN CREATED SUCCESSFULLY!
              </h3>
              
              <div>
                <p className="text-sm font-semibold text-white mb-1">
                  Token Mint Address:
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={createdMint}
                    readOnly
                    className="flex-1 px-3 py-2 bg-zinc-800 border border-white rounded text-sm font-mono text-white"
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(createdMint)}
                    className="px-4 py-2 bg-green-500 text-black rounded hover:bg-green-400 text-sm font-semibold transition-colors"
                  >
                    COPY
                  </button>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-white mb-1">
                  Your Token Account Address:
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={createdATA}
                    readOnly
                    className="flex-1 px-3 py-2 bg-zinc-800 border border-white rounded text-sm font-mono text-white"
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(createdATA)}
                    className="px-4 py-2 bg-green-500 text-black rounded hover:bg-green-400 text-sm font-semibold transition-colors"
                  >
                    COPY
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-green-500">
                <p className="text-sm text-gray-300 mb-2">
                  <span className="font-semibold text-white">Token Name:</span> {tokenName}
                </p>
                <p className="text-sm text-gray-300 mb-2">
                  <span className="font-semibold text-white">Token Symbol:</span> {tokenSymbol}
                </p>
                <p className="text-sm text-gray-300 mb-2">
                  <span className="font-semibold text-white">Decimals:</span> {decimals}
                </p>
                <p className="text-sm text-gray-300">
                  <span className="font-semibold text-white">Initial Supply:</span> {initialSupply}
                </p>
              </div>

              <div className="pt-4 border-t border-green-500">
                <a
                  href={`https://explorer.solana.com/address/${createdMint}?cluster=${network}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block w-full text-center bg-white text-black font-bold py-3 px-6 rounded-lg hover:bg-gray-200 transition-all"
                >
                  🔍 VIEW ON SOLANA EXPLORER
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TokenCreator;