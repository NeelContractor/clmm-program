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
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-8 font-mono">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              Solana Token Creator
            </h1>
            <p className="text-gray-600">Create SPL tokens on Solana</p>
          </div>

          <div className='flex justify-between p-2'>
            <Link href={"/"} className='bg-black text-white rounded-xl px-5 py-2 hover:bg-gray-800'>
              Back
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
              className="w-full bg-yellow-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-yellow-600 transition-all mb-6 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              💰 Request 2 SOL Airdrop (Devnet)
            </button>
          )}

          {/* Token Creation Form */}
          {wallet && (
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Token Name
                </label>
                <input
                  type="text"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  placeholder="e.g., My Awesome Token"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Token Symbol
                </label>
                <input
                  type="text"
                  value={tokenSymbol}
                  onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                  placeholder="e.g., MAT"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent uppercase"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Decimals
                </label>
                <select
                  value={decimals}
                  onChange={(e) => setDecimals(Number(e.target.value))}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Initial Supply
                </label>
                <input
                  type="number"
                  value={initialSupply}
                  onChange={(e) => setInitialSupply(e.target.value)}
                  placeholder="e.g., 1000000"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  The number of tokens to mint initially (in human-readable format)
                </p>
              </div>

              <button
                onClick={createToken}
                disabled={loading || !tokenName || !tokenSymbol || !initialSupply}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-4 px-6 rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all transform hover:scale-105 shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? '⏳ Creating Token...' : '🚀 Create Token'}
              </button>
            </div>
          )}

          {/* Status Messages */}
          {status && (
            <div className="mb-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
              <p className="text-sm font-semibold text-blue-800">{status}</p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
              <p className="text-sm font-semibold text-red-800">{error}</p>
            </div>
          )}

          {/* Results */}
          {createdMint && (
            <div className="space-y-4 p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg">
              <h3 className="text-xl font-bold text-green-800 mb-4">
                ✅ Token Created Successfully!
              </h3>
              
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-1">
                  Token Mint Address:
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={createdMint}
                    readOnly
                    className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded text-sm font-mono"
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(createdMint)}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm font-semibold"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-700 mb-1">
                  Your Token Account Address:
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={createdATA}
                    readOnly
                    className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded text-sm font-mono"
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(createdATA)}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm font-semibold"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-green-200">
                <p className="text-sm text-gray-700 mb-2">
                  <span className="font-semibold">Token Name:</span> {tokenName}
                </p>
                <p className="text-sm text-gray-700 mb-2">
                  <span className="font-semibold">Token Symbol:</span> {tokenSymbol}
                </p>
                <p className="text-sm text-gray-700 mb-2">
                  <span className="font-semibold">Decimals:</span> {decimals}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Initial Supply:</span> {initialSupply}
                </p>
              </div>

              <div className="pt-4 border-t border-green-200">
                <a
                  href={`https://explorer.solana.com/address/${createdMint}?cluster=${network}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block w-full text-center bg-purple-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-purple-700 transition-all"
                >
                  🔍 View on Solana Explorer
                </a>
              </div>
            </div>
          )}

          {/* Instructions */}
          {/* <div className="mt-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="font-bold text-gray-800 mb-3">📋 Instructions:</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
              <li>Select network (Devnet for testing, Mainnet for production)</li>
              <li>Connect your Phantom wallet</li>
              <li>If on Devnet, request a SOL airdrop for gas fees</li>
              <li>Fill in token details (name, symbol, decimals, supply)</li>
              <li>Click "Create Token" and approve the transaction</li>
              <li>Copy your Token Mint Address to use in your CLMM pool!</li>
            </ol>
            
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-xs font-semibold text-yellow-800">
                ⚠️ Important: Save your Token Mint Address! You'll need it to initialize your CLMM pool.
              </p>
            </div>
          </div> */}
        </div>
      </div>
    </div>
  );
};

export default TokenCreator;