"use client"

import React, { useState, useEffect } from 'react';
import { Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { 
  createMintToInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getMint,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  initializeMint2InstructionData,
  initializeMintInstructionData,
  createInitializeMint2Instruction
} from '@solana/spl-token';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletButton } from '@/components/solana/solana-provider';
import Link from 'next/link';
import bs58 from "bs58";
// import dotenv from "dotenv";
// dotenv.config();

// const MINT_AUTHORITY = new PublicKey("GToMxgF4JcNn8dmNiHt2JrrvLaW6S1zSPoL2W8K2Wkmi");
// TODO: Add logic to other users to mint tokens

const TokenMinter = () => {
  const { publicKey, signTransaction, wallet } = useWallet();
  const { connection } = useConnection();

  let key = Uint8Array.from(JSON.parse(process.env.NEXT_PUBLIC_MINT_AUTHORITY_KEYPAIR!))
  const MINT_AUTHORITY = Keypair.fromSecretKey(key);

  // console.log("MINT_AUTHORITY: ", MINT_AUTHORITY.publicKey.toBase58());
  // Predefined devnet tokens
  const DEVNET_TOKENS = [
    {
      name: 'Test USDC',
      symbol: 'TUSDC',
      mint: 'HN9QvLdNkRJ9GpckLmLVCGQkTu3ARr23eAdx8o2MYcFk',
      decimals: 6,
      description: 'Your Test USDC token'
    },
    {
      name: 'Test BTC',
      symbol: 'TBTC',
      mint: 'AdtHQVQVzuL2Xc1XRf4e1GaVaQkgX16kwmPvTmgRBtES',
      decimals: 8,
      description: 'Your Test Bitcoin token'
    },
    {
      name: 'Test SOL',
      symbol: 'TSOL',
      mint: 'DkyPc5MBnoPw7v7moi8pXhL4Sch92B9na2Tr7grx79V2',
      decimals: 9,
      description: 'Your Test SOL token'
    }
  ];
  
  // Form states
  const [tokenMint, setTokenMint] = useState('');
  const [mintAmount, setMintAmount] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [selectedDevnetToken, setSelectedDevnetToken] = useState('');
  
  // Token info states
  const [tokenInfo, setTokenInfo] = useState<any>(null);
  const [userBalance, setUserBalance] = useState<string>('');
  const [recipientBalance, setRecipientBalance] = useState<string>('');
  const [userTokens, setUserTokens] = useState<any[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  // Auto-fill recipient with user's address
  useEffect(() => {
    if (publicKey && !recipientAddress) {
      setRecipientAddress(publicKey.toString());
    }
  }, [publicKey]);

  // Fetch user's tokens when wallet connects
  useEffect(() => {
    if (publicKey && connection) {
      fetchUserTokens();
    }
  }, [publicKey, connection]);

  // Fetch all tokens where user is mint authority
  const fetchUserTokens = async () => {
    if (!publicKey || !connection) return;

    setLoadingTokens(true);
    try {
      // Get all token accounts owned by user
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        { programId: TOKEN_PROGRAM_ID }
      );

      const tokens: any[] = [];

      for (const { account } of tokenAccounts.value) {
        const parsedInfo = account.data.parsed.info;
        const mintAddress = new PublicKey(parsedInfo.mint);

        try {
          // Get mint info
          const mintInfo = await getMint(connection, mintAddress);
          
          // Only include tokens where user is mint authority
            tokens.push({
              mint: mintAddress.toString(),
              decimals: mintInfo.decimals,
              balance: parsedInfo.tokenAmount.uiAmount,
              supply: Number(mintInfo.supply) / Math.pow(10, mintInfo.decimals)
            });
        } catch (e) {
          // Skip tokens we can't fetch
          continue;
        }
      }

      setUserTokens(tokens);
    } catch (err) {
      console.error('Error fetching user tokens:', err);
    } finally {
      setLoadingTokens(false);
    }
  };

  // Fetch token info
  const fetchTokenInfo = async () => {
    if (!tokenMint || !connection) return;

    try {
      setLoadingInfo(true);
      setError('');
      
      const mintPubkey = new PublicKey(tokenMint);
      const mintInfo = await getMint(connection, mintPubkey);
      
      setTokenInfo({
        address: tokenMint,
        decimals: mintInfo.decimals,
        supply: (Number(mintInfo.supply) / Math.pow(10, mintInfo.decimals)).toLocaleString(),
        mintAuthority: mintInfo.mintAuthority?.toString() || 'None',
        freezeAuthority: mintInfo.freezeAuthority?.toString() || 'None',
      });

      // Get user's token balance if connected
      if (publicKey) {
        try {
          const userATA = await getAssociatedTokenAddress(
            mintPubkey,
            publicKey,
            false,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          );
          const accountInfo = await getAccount(connection, userATA);
          setUserBalance((Number(accountInfo.amount) / Math.pow(10, mintInfo.decimals)).toLocaleString());
        } catch {
          setUserBalance('0 (No token account)');
        }
      }

      setStatus('Token info loaded successfully');
    } catch (err: any) {
      setError(`Failed to fetch token info: ${err.message}`);
      setTokenInfo(null);
    } finally {
      setLoadingInfo(false);
    }
  };

  // Check recipient balance
  const checkRecipientBalance = async () => {
    if (!tokenMint || !recipientAddress || !connection || !tokenInfo) return;

    try {
      const mintPubkey = new PublicKey(tokenMint);
      const recipientPubkey = new PublicKey(recipientAddress);
      
      const recipientATA = await getAssociatedTokenAddress(
        mintPubkey,
        recipientPubkey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      
      const accountInfo = await getAccount(connection, recipientATA);
      setRecipientBalance((Number(accountInfo.amount) / Math.pow(10, tokenInfo.decimals)).toLocaleString());
    } catch {
      setRecipientBalance('0 (No token account - will create)');
    }
  };

  useEffect(() => {
    if (recipientAddress && tokenInfo) {
      checkRecipientBalance();
    }
  }, [recipientAddress, tokenInfo]);

  // Mint tokens
  const mintTokens = async () => {
    if (!publicKey || !connection) {
      setError('Please connect your wallet first');
      return;
    }

    if (!signTransaction) {
      setError('Wallet does not support signing transactions');
      return;
    }

    if (!tokenMint || !mintAmount || !recipientAddress) {
      setError('Please fill in all fields');
      return;
    }

    if (!tokenInfo) {
      setError('Please load token info first');
      return;
    }

    setLoading(true);
    setStatus('Preparing to mint tokens...');
    setError('');

    try {
      const mintPubkey = new PublicKey(tokenMint);
      const recipientPubkey = new PublicKey(recipientAddress);

      // Get recipient's associated token account
      const recipientATA = await getAssociatedTokenAddress(
        mintPubkey,
        recipientPubkey,
        // false,
        // TOKEN_PROGRAM_ID,
        // ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const transaction = new Transaction();

      // Check if recipient's token account exists
      setStatus('Checking recipient token account...');
      const accountInfo = await connection.getAccountInfo(recipientATA);
      
      if (!accountInfo) {
        setStatus('Creating token account for recipient...');
        // Create associated token account for recipient
        transaction.add(
          createAssociatedTokenAccountInstruction(
            publicKey, // payer
            recipientATA, // associated token address
            recipientPubkey, // owner
            mintPubkey, // mint
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
      }

      // Add mint instruction
      setStatus('Adding mint instruction...');
      const mintAmountRaw = BigInt(
        parseFloat(mintAmount) * Math.pow(10, tokenInfo.decimals)
      );

      const recipientAssociatedTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection, MINT_AUTHORITY, mintPubkey, publicKey
      )

      // const recipientAssociatedTokenAccount = await getAssociatedTokenAddress(
      //   mintPubkey,
      //   publicKey
      // );

    const transactionSignature = await mintTo(
        connection,
        MINT_AUTHORITY,
        mintPubkey,
        recipientAssociatedTokenAccount.address,
        MINT_AUTHORITY,
        mintAmountRaw
    )

    // const link = getExplorerLink("transaction", transactionSignature, "devnet");
    console.log(transactionSignature);

      // const tx = await fetch("/api/mint", {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //   },
      //   body: JSON.stringify({
      //     mint: mintPubkey.toBase58(),         
      //     destination: recipientATA.toBase58(),
      //     amount: mintAmountRaw.toString(),    
      //   }),
      // });

      // console.log("tx: ", tx);

      // transaction.add(
      //   createMintToInstruction(
      //     mintPubkey,
      //     recipientATA,
      //     MINT_AUTHORITY.publicKey,
      //     mintAmountRaw,
      //     [],
      //     TOKEN_PROGRAM_ID
      //   )
      // );

      // // Get recent blockhash
      // setStatus('Getting recent blockhash...');
      // const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      // transaction.recentBlockhash = blockhash;
      // transaction.feePayer = publicKey;

      // // Sign transaction
      // setStatus('Signing transaction...');
      // const signed = await signTransaction(transaction);

      // // Send transaction
      // setStatus('Sending transaction...');
      // const signature = await connection.sendRawTransaction(signed.serialize()); // TODO: failing because of MINT_AUHTORITY didnt sign the txn

      // Confirm transaction
      // setStatus('Confirming transaction...');
      // await connection.confirmTransaction({
      //   signature,
      //   blockhash,
      //   lastValidBlockHeight
      // });

      setStatus(`✅ Successfully minted ${mintAmount} tokens!`);
      setError('');

      // Refresh balances
      await fetchTokenInfo();
      await checkRecipientBalance();

      // Clear form
      setMintAmount('');
    } catch (err: any) {
      console.error('Error minting tokens:', err);
      setError(`Failed to mint tokens: ${err.message || err}`);
      setStatus('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black p-8 font-mono">
      <div className="max-w-4xl mx-auto">
        <div className="bg-zinc-900 border-2 border-white rounded-2xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">
              TOKEN MINTER
            </h1>
            <p className="text-gray-400">MINT ADDITIONAL TOKENS</p>
          </div>

          <div className='flex justify-between p-2 mb-6'>
            <Link href={"/"} className='bg-red-500 text-white rounded-xl px-5 py-2 hover:bg-red-600 transition-colors font-bold'>
              ← BACK
            </Link>

            <div className="flex justify-end">
              <WalletButton />
            </div>
          </div>

          {/* Devnet Token Quick Selector */}
          <div className="mb-6 p-4 bg-black border-2 border-green-500 rounded-lg">
            <h3 className="text-sm font-bold text-green-500 mb-3">⚡ QUICK SELECT - YOUR DEVNET TOKENS</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {DEVNET_TOKENS.map((token) => (
                <button
                  key={token.mint}
                  onClick={() => {
                    setTokenMint(token.mint);
                    setSelectedDevnetToken(token.mint);
                    setTokenInfo(null);
                    setUserBalance('');
                    setRecipientBalance('');
                  }}
                  className={`p-4 text-left border-2 rounded-lg transition-all ${
                    selectedDevnetToken === token.mint
                      ? 'border-green-500 bg-green-500/20'
                      : 'border-white bg-zinc-800 hover:border-green-500 hover:bg-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">
                      {token.symbol === 'TUSDC' ? '💵' : '₿'}
                    </span>
                    <div>
                      <div className="font-bold text-sm text-white">
                        {token.symbol} - {token.name}
                      </div>
                      <div className="text-xs text-gray-400">
                        {token.description}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 font-mono break-all">
                    {token.mint.slice(0, 20)}...{token.mint.slice(-12)}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Decimals: <span className="font-semibold text-white">{token.decimals}</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-3 p-2 bg-green-500/20 border border-green-500 rounded text-xs text-green-400">
              💡 <span className="font-semibold">Tip:</span> These are your pre-created devnet tokens. Click to select, then click "LOAD" below.
            </div>
          </div>

          {/* Loading user tokens */}
          {loadingTokens && publicKey && (
            <div className="mb-6 p-4 bg-zinc-800 border-2 border-white rounded-lg">
              <p className="text-sm font-semibold text-white">
                🔍 Loading your tokens...
              </p>
            </div>
          )}

          {/* No tokens message */}
          {publicKey && !loadingTokens && userTokens.length === 0 && (
            <div className="mb-6 p-4 bg-red-500/20 border-2 border-red-500 rounded-lg">
              <p className="text-sm font-semibold text-red-500 mb-2">
                ℹ️ No tokens found where you're the mint authority
              </p>
              <p className="text-xs text-gray-400">
                Create a token first using the Token Creator, then come back here to mint more!
              </p>
            </div>
          )}

          {/* Token Mint Input */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-white mb-2">
              TOKEN MINT ADDRESS
            </label>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={tokenMint}
                onChange={(e) => setTokenMint(e.target.value)}
                placeholder="Paste token mint address or select from above..."
                className="flex-1 px-4 py-3 bg-zinc-800 border-2 border-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono text-sm text-white placeholder-gray-500"
              />
              <button
                onClick={fetchTokenInfo}
                disabled={!tokenMint || loadingInfo}
                className="px-6 py-3 bg-green-500 text-black font-bold rounded-lg hover:bg-green-400 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
              >
                {loadingInfo ? '⏳' : '🔍 LOAD'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Click a token above or paste any token mint address
            </p>
          </div>

          {/* Token Info Display */}
          {tokenInfo && (
            <div className="mb-6 p-6 bg-black border-2 border-white rounded-lg">
              <h3 className="text-lg font-bold text-white mb-4">📊 TOKEN INFORMATION</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-semibold text-gray-400">Decimals:</span>
                  <span className="ml-2 text-white">{tokenInfo.decimals}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-400">Total Supply:</span>
                  <span className="ml-2 text-white">{tokenInfo.supply}</span>
                </div>
                <div className="col-span-2">
                  <span className="font-semibold text-gray-400">Mint Authority:</span>
                  <span className="ml-2 text-white font-mono text-xs break-all">
                    {tokenInfo.mintAuthority}
                  </span>
                </div>
                {publicKey && userBalance && (
                  <div className="col-span-2">
                    <span className="font-semibold text-gray-400">Your Balance:</span>
                    <span className="ml-2 text-white">{userBalance}</span>
                  </div>
                )}
              </div>

              {/* Authority Check */}
              {publicKey && tokenInfo.mintAuthority === publicKey.toString() && (
                <div className="mt-4 p-3 bg-green-500/20 border border-green-500 rounded">
                  <p className="text-sm font-semibold text-green-500">
                    ✅ You are the mint authority. You can mint tokens!
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Minting Form */}
          {publicKey && tokenInfo && (
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  RECIPIENT ADDRESS
                </label>
                <input
                  type="text"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  placeholder="Recipient wallet address"
                  className="w-full px-4 py-3 bg-zinc-800 border-2 border-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono text-sm text-white placeholder-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  The wallet address that will receive the tokens
                </p>
                {recipientBalance && (
                  <p className="text-xs text-green-500 mt-1">
                    Current balance: {recipientBalance}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  AMOUNT TO MINT
                </label>
                <input
                  type="number"
                  value={mintAmount}
                  onChange={(e) => setMintAmount(e.target.value)}
                  placeholder="e.g., 1000"
                  className="w-full px-4 py-3 bg-zinc-800 border-2 border-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-white placeholder-gray-500"
                  step="any"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Amount in human-readable format (will be converted using decimals: {tokenInfo.decimals})
                </p>
              </div>

              <button
                onClick={mintTokens}
                disabled={loading || !mintAmount || !recipientAddress}
                className="w-full bg-green-500 text-black font-bold py-4 px-6 rounded-lg hover:bg-green-400 transition-all transform hover:scale-105 shadow-lg disabled:bg-gray-600 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? 'MINTING TOKENS...' : 'MINT TOKENS'}
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
        </div>
      </div>
    </div>
  );
};

export default TokenMinter;