"use client"

import React, { useState, useEffect } from 'react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { 
  createMintToInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getMint,
  getAccount
} from '@solana/spl-token';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletButton } from '@/components/solana/solana-provider';
import Link from 'next/link';

const ADMIN_PUBKEY = new PublicKey("GToMxgF4JcNn8dmNiHt2JrrvLaW6S1zSPoL2W8K2Wkmi");

const TokenMinter = () => {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();

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
          if (mintInfo.mintAuthority?.toString() === publicKey.toString()) {
            tokens.push({
              mint: mintAddress.toString(),
              decimals: mintInfo.decimals,
              balance: parsedInfo.tokenAmount.uiAmount,
              supply: Number(mintInfo.supply) / Math.pow(10, mintInfo.decimals)
            });
          }
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

      // Check if user is mint authority
      if (tokenInfo.mintAuthority !== publicKey.toString()) {
        throw new Error(`You are not the mint authority. Mint authority: ${tokenInfo.mintAuthority}`);
      }

      // Get recipient's associated token account
      const recipientATA = await getAssociatedTokenAddress(
        mintPubkey,
        recipientPubkey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
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

      transaction.add(
        createMintToInstruction(
          mintPubkey,
          recipientATA,
          publicKey, // mint authority
          mintAmountRaw,
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-8 font-mono">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              Token Minter
            </h1>
            <p className="text-gray-600">Mint additional tokens</p>
          </div>

          <div className='flex justify-between p-2'>
            <Link href={"/"} className='bg-black text-white rounded-xl px-5 py-2 hover:bg-gray-800'>
              Back
            </Link>

            <div className="flex justify-end">
              <WalletButton />
            </div>
          </div>

          {/* Devnet Token Quick Selector */}
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-lg">
            <h3 className="text-sm font-bold text-blue-800 mb-3">⚡ Quick Select - Your Devnet Tokens</h3>
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
                      ? 'border-blue-500 bg-blue-100'
                      : 'border-blue-200 bg-white hover:border-blue-400 hover:bg-blue-50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">
                      {token.symbol === 'USDC' ? '💵' : '₿'}
                    </span>
                    <div>
                      <div className="font-bold text-sm text-gray-800">
                        {token.symbol} - {token.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {token.description}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 font-mono break-all">
                    {token.mint.slice(0, 20)}...{token.mint.slice(-12)}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Decimals: <span className="font-semibold">{token.decimals}</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-3 p-2 bg-blue-100 rounded text-xs text-blue-800">
              💡 <span className="font-semibold">Tip:</span> These are your pre-created devnet tokens. Click to select, then click "🔍 Load" below.
            </div>
          </div>

          {/* Loading user tokens */}
          {loadingTokens && publicKey && (
            <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
              <p className="text-sm font-semibold text-blue-800">
                🔍 Loading your tokens...
              </p>
            </div>
          )}

          {/* User's Tokens Selector */}
          {/* {userTokens.length > 0 && !loadingTokens && (
            <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg">
              <h3 className="text-sm font-bold text-green-800 mb-3">
                🎯 Your Tokens (Where You're Mint Authority)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {userTokens.map((token, idx) => (
                  <button
                    key={token.mint}
                    onClick={() => {
                      setTokenMint(token.mint);
                      setTokenInfo(null);
                      setUserBalance('');
                      setRecipientBalance('');
                    }}
                    className={`p-4 text-left border-2 rounded-lg transition-all ${
                      tokenMint === token.mint
                        ? 'border-green-500 bg-green-100'
                        : 'border-green-200 bg-white hover:border-green-400 hover:bg-green-50'
                    }`}
                  >
                    <div className="font-semibold text-sm text-gray-800 mb-1">
                      Token #{idx + 1}
                    </div>
                    <div className="text-xs text-gray-500 font-mono mb-2 break-all">
                      {token.mint.slice(0, 12)}...{token.mint.slice(-8)}
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">
                        Decimals: <span className="font-semibold">{token.decimals}</span>
                      </span>
                      <span className="text-gray-600">
                        Supply: <span className="font-semibold">{token.supply.toLocaleString()}</span>
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      Your Balance: <span className="font-semibold">{token.balance}</span>
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={fetchUserTokens}
                disabled={loadingTokens}
                className="mt-3 w-full px-4 py-2 bg-green-500 text-white text-sm font-semibold rounded-lg hover:bg-green-600 disabled:bg-gray-400"
              >
                🔄 Refresh Tokens
              </button>
            </div>
          )} */}

          {/* No tokens message */}
          {publicKey && !loadingTokens && userTokens.length === 0 && (
            <div className="mb-6 p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
              <p className="text-sm font-semibold text-yellow-800 mb-2">
                ℹ️ No tokens found where you're the mint authority
              </p>
              <p className="text-xs text-yellow-700">
                Create a token first using the Token Creator, then come back here to mint more!
              </p>
            </div>
          )}

          {/* Token Mint Input */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Token Mint Address
            </label>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={tokenMint}
                onChange={(e) => setTokenMint(e.target.value)}
                placeholder="Paste token mint address or select from above..."
                className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
              />
              <button
                onClick={fetchTokenInfo}
                disabled={!tokenMint || loadingInfo}
                className="px-6 py-3 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loadingInfo ? '⏳' : '🔍 Load'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Click a token above or paste any token mint address
            </p>
          </div>

          {/* Token Info Display */}
          {tokenInfo && (
            <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg">
              <h3 className="text-lg font-bold text-blue-800 mb-4">📊 Token Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-semibold text-gray-700">Decimals:</span>
                  <span className="ml-2 text-gray-600">{tokenInfo.decimals}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Total Supply:</span>
                  <span className="ml-2 text-gray-600">{tokenInfo.supply}</span>
                </div>
                <div className="col-span-2">
                  <span className="font-semibold text-gray-700">Mint Authority:</span>
                  <span className="ml-2 text-gray-600 font-mono text-xs break-all">
                    {tokenInfo.mintAuthority}
                  </span>
                </div>
                {publicKey && userBalance && (
                  <div className="col-span-2">
                    <span className="font-semibold text-gray-700">Your Balance:</span>
                    <span className="ml-2 text-gray-600">{userBalance}</span>
                  </div>
                )}
              </div>

              {/* Authority Check */}
              {publicKey && tokenInfo.mintAuthority !== publicKey.toString() && (
                <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded">
                  <p className="text-sm font-semibold text-red-800">
                    ⚠️ You are NOT the mint authority for this token. You cannot mint tokens.
                  </p>
                </div>
              )}

              {publicKey && tokenInfo.mintAuthority === publicKey.toString() && (
                <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded">
                  <p className="text-sm font-semibold text-green-800">
                    ✅ You are the mint authority. You can mint tokens!
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Minting Form */}
          {publicKey && tokenInfo && tokenInfo.mintAuthority === publicKey.toString() && (
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Recipient Address
                </label>
                <input
                  type="text"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  placeholder="Recipient wallet address"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  The wallet address that will receive the tokens
                </p>
                {recipientBalance && (
                  <p className="text-xs text-blue-600 mt-1">
                    Current balance: {recipientBalance}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Amount to Mint
                </label>
                <input
                  type="number"
                  value={mintAmount}
                  onChange={(e) => setMintAmount(e.target.value)}
                  placeholder="e.g., 1000"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  step="any"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Amount in human-readable format (will be converted using decimals: {tokenInfo.decimals})
                </p>
              </div>

              <button
                onClick={mintTokens}
                disabled={loading || !mintAmount || !recipientAddress}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-4 px-6 rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all transform hover:scale-105 shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? '⏳ Minting Tokens...' : '🏭 Mint Tokens'}
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

          {/* Instructions */}
          {/* <div className="mt-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="font-bold text-gray-800 mb-3">📋 How to Mint Tokens:</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
              <li>Connect your wallet (must be the mint authority)</li>
              <li>Paste your token mint address and click 🔍 to load token info</li>
              <li>Verify you are the mint authority (green checkmark)</li>
              <li>Enter recipient address (defaults to your address)</li>
              <li>Enter amount to mint in human-readable format</li>
              <li>Click "Mint Tokens" and approve the transaction</li>
            </ol>
            
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-xs font-semibold text-yellow-800 mb-2">
                ⚠️ Important Notes:
              </p>
              <ul className="text-xs text-yellow-700 space-y-1 list-disc list-inside">
                <li>Only the mint authority can mint new tokens</li>
                <li>If recipient doesn't have a token account, one will be created automatically</li>
                <li>Minting increases the total supply of the token</li>
                <li>Be careful with decimals - the amount is multiplied by 10^decimals</li>
              </ul>
            </div>

            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
              <p className="text-xs font-semibold text-green-800 mb-2">
                💡 Use Cases:
              </p>
              <ul className="text-xs text-green-700 space-y-1 list-disc list-inside">
                <li>Mint tokens to yourself to add liquidity to your CLMM pool</li>
                <li>Distribute tokens to team members or community</li>
                <li>Create test tokens for development and testing</li>
                <li>Reward users with additional tokens</li>
              </ul>
            </div>
          </div> */}
        </div>
      </div>
    </div>
  );
};

export default TokenMinter;