"use client"
import { useWallet } from "@solana/wallet-adapter-react"
import { useClmmProgram } from "./clmm-data-access";
import { WalletButton } from "../solana/solana-provider";
import { BN } from "bn.js";
import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import Link from "next/link";

const ADMIN_PUBKEY = new PublicKey("GToMxgF4JcNn8dmNiHt2JrrvLaW6S1zSPoL2W8K2Wkmi");

export default function Clmm() {
    const { publicKey } = useWallet();
    const { 
        initializePoolHandler, 
        increaseLiquidityHandler, 
        openPositionHandler, 
        decreaseLiquidityHandler, 
        swapHandler, 
        poolAccounts, 
        positionAccounts, 
        tickArrayAccounts 
    } = useClmmProgram();
    
    const [activeTab, setActiveTab] = useState<'pools' | 'positions' | 'swap' | 'create'>('pools'); // TODO: add logic to show create tab only if the publicKey.equals(ADMIN_PUBKEY)
    
    // Initialize Pool Form State
    const [initPoolForm, setInitPoolForm] = useState({
        tokenMint0: '',
        tokenMint1: '',
        tickSpacing: '10',
        initialSqrtPrice: '79228162514264337593543950336'
    });

    // Open Position Form State
    const [openPosForm, setOpenPosForm] = useState({
        poolAddress: '',
        lowerTick: '-100',
        upperTick: '100',
        liquidityAmount: '1000000'
    });

    // Increase Liquidity Form State
    const [increaseLiqForm, setIncreaseLiqForm] = useState({
        positionAddress: '',
        liquidityAmount: '500000'
    });

    // Decrease Liquidity Form State
    const [decreaseLiqForm, setDecreaseLiqForm] = useState({
        positionAddress: '',
        liquidityAmount: '500000'
    });

    // Swap Form State
    const [swapForm, setSwapForm] = useState({
        poolAddress: '',
        amountIn: '1000',
        swapToken0For1: true,
        amountOutMinimum: '990'
    });

    const handleInitializePool = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!publicKey) return;
        
        try {
            await initializePoolHandler.mutateAsync({
                payerPubkey: publicKey,
                TICK_SPACING: parseInt(initPoolForm.tickSpacing),
                INITIAL_SQRT_PRICE: new BN(initPoolForm.initialSqrtPrice),
                tokenMint0: new PublicKey(initPoolForm.tokenMint0),
                tokenMint1: new PublicKey(initPoolForm.tokenMint1)
            });
            // Reset form
            setInitPoolForm({
                tokenMint0: '',
                tokenMint1: '',
                tickSpacing: '10',
                initialSqrtPrice: '79228162514264337593543950336'
            });
        } catch (error) {
            console.error('Error initializing pool:', error);
        }
    };

    const handleOpenPosition = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!publicKey) return;
        
        try {
            const poolData = poolAccounts.data?.find(p => p.publicKey.toString() === openPosForm.poolAddress);
            if (!poolData) return;

            await openPositionHandler.mutateAsync({
                payerPubkey: publicKey,
                TICK_SPACING: poolData.account.tickSpacing,
                LOWER_TICK: parseInt(openPosForm.lowerTick),
                UPPER_TICK: parseInt(openPosForm.upperTick),
                LIQUIDITY_AMOUNT: new BN(openPosForm.liquidityAmount),
                tokenMint0: poolData.account.tokenMint0,
                tokenMint1: poolData.account.tokenMint1,
                tokenVault0Pubkey: poolData.account.tokenVault0,
                tokenVault1Pubkey: poolData.account.tokenVault1
            });
        } catch (error) {
            console.error('Error opening position:', error);
        }
    };

    const handleIncreaseLiquidity = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!publicKey) return;
        
        try {
            const positionData = positionAccounts.data?.find(p => p.publicKey.toString() === increaseLiqForm.positionAddress);
            if (!positionData) return;

            const poolData = poolAccounts.data?.find(p => p.publicKey.equals(positionData.account.pool));
            if (!poolData) return;

            await increaseLiquidityHandler.mutateAsync({
                payerPubkey: publicKey,
                TICK_SPACING: poolData.account.tickSpacing,
                LOWER_TICK: positionData.account.tickLower,
                UPPER_TICK: positionData.account.tickUpper,
                liquidityAmount: new BN(increaseLiqForm.liquidityAmount),
                tokenMint0: poolData.account.tokenMint0,
                tokenMint1: poolData.account.tokenMint1,
                tokenVault0Pubkey: poolData.account.tokenVault0,
                tokenVault1Pubkey: poolData.account.tokenVault1
            });
        } catch (error) {
            console.error('Error increasing liquidity:', error);
        }
    };

    const handleDecreaseLiquidity = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!publicKey) return;
        
        try {
            const positionData = positionAccounts.data?.find(p => p.publicKey.toString() === decreaseLiqForm.positionAddress);
            if (!positionData) return;

            const poolData = poolAccounts.data?.find(p => p.publicKey.equals(positionData.account.pool));
            if (!poolData) return;

            await decreaseLiquidityHandler.mutateAsync({
                payerPubkey: publicKey,
                TICK_SPACING: poolData.account.tickSpacing,
                LOWER_TICK: positionData.account.tickLower,
                UPPER_TICK: positionData.account.tickUpper,
                liquidityToRemove: new BN(decreaseLiqForm.liquidityAmount),
                tokenMint0: poolData.account.tokenMint0,
                tokenMint1: poolData.account.tokenMint1,
                tokenVault0Pubkey: poolData.account.tokenVault0,
                tokenVault1Pubkey: poolData.account.tokenVault1
            });
        } catch (error) {
            console.error('Error decreasing liquidity:', error);
        }
    };

    const handleSwap = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!publicKey) return;
        
        try {
            const poolData = poolAccounts.data?.find(p => p.publicKey.toString() === swapForm.poolAddress);
            if (!poolData) return;

            await swapHandler.mutateAsync({
                payerPubkey: publicKey,
                TICK_SPACING: poolData.account.tickSpacing,
                tokenMint0: poolData.account.tokenMint0,
                tokenMint1: poolData.account.tokenMint1,
                tokenVault0Pubkey: poolData.account.tokenVault0,
                tokenVault1Pubkey: poolData.account.tokenVault1,
                amountIn: new BN(swapForm.amountIn),
                swapToken0For1: swapForm.swapToken0For1,
                amountOutMinimum: new BN(swapForm.amountOutMinimum)
            });
        } catch (error) {
            console.error('Error swapping:', error);
        }
    };

    if (!publicKey) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-4">
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl p-12 shadow-2xl border border-blue-500/30 max-w-md w-full">
                    <div className="text-center mb-8">
                        <div className="inline-block p-4 bg-blue-500/20 rounded-2xl mb-4">
                            <svg className="w-16 h-16 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                            CLMM Protocol
                        </h1>
                        <p className="text-slate-300 text-lg">Concentrated Liquidity Market Maker</p>
                    </div>
                    <p className="text-slate-400 mb-6 text-center">Connect your wallet to access liquidity pools and trading</p>
                    <div className="flex justify-center">
                        <WalletButton />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-6 font-mono">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                            CLMM Protocol
                        </h1>
                        <p className="text-slate-400 mt-1">Manage your liquidity positions</p>
                    </div>
                    
                    <div className="flex justify-around gap-2 items-center">
                        {publicKey.equals(ADMIN_PUBKEY) && (
                            <Link href={"/create"} className="text-xl hover:text-green-200">
                                Create Mint
                            </Link>
                        )}
                        
                        <div>
                            <Link href={"/mint"} className="text-xl hover:text-green-200">
                                Mint Tokens
                            </Link> 
                        </div>
                        <WalletButton />
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 bg-slate-800/50 p-2 rounded-2xl backdrop-blur-xl border border-slate-700/50">
                    {(['pools', 'positions', 'swap', 'create'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all duration-200 ${
                                activeTab === tab
                                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                            }`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Pools Tab */}
                {activeTab === 'pools' && (
                    <div className="space-y-6">
                        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
                            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                                Active Pools
                            </h2>
                            {poolAccounts.isLoading ? (
                                <div className="text-center py-8 text-slate-400">Loading pools...</div>
                            ) : poolAccounts.data?.length === 0 ? (
                                <div className="text-center py-8 text-slate-400">No pools found. Create one to get started!</div>
                            ) : (
                                <div className="space-y-4">
                                    {poolAccounts.data?.map((pool) => (
                                        <div key={pool.publicKey.toString()} className="bg-slate-700/50 rounded-xl p-5 border border-slate-600/50 hover:border-blue-500/50 transition-all">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex-1">
                                                    <p className="text-xs text-slate-400 mb-1">Pool Address</p>
                                                    <p className="font-mono text-sm text-blue-400 break-all">{pool.publicKey.toString()}</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <div>
                                                    <p className="text-xs text-slate-400 mb-1">Token 0</p>
                                                    <p className="font-mono text-xs text-slate-200 truncate">{pool.account.tokenMint0.toString()}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-400 mb-1">Token 1</p>
                                                    <p className="font-mono text-xs text-slate-200 truncate">{pool.account.tokenMint1.toString()}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-400 mb-1">Liquidity</p>
                                                    <p className="text-sm font-semibold text-green-400">{pool.account.globalLiquidity.toString()}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-400 mb-1">Current Tick</p>
                                                    <p className="text-sm font-semibold text-purple-400">{pool.account.currentTick}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Positions Tab */}
                {activeTab === 'positions' && (
                    <div className="space-y-6">
                        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
                            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                                <span className="text-purple-400">📊</span> Your Positions
                            </h2>
                            {positionAccounts.isLoading ? (
                                <div className="text-center py-8 text-slate-400">Loading positions...</div>
                            ) : positionAccounts.data?.filter(p => p.account.owner.equals(publicKey))?.length === 0 ? (
                                <div className="text-center py-8 text-slate-400">No positions found. Open a position to start earning fees!</div>
                            ) : (
                                <div className="space-y-4">
                                    {positionAccounts.data?.filter(p => p.account.owner.equals(publicKey)).map((position) => (
                                        <div key={position.publicKey.toString()} className="bg-slate-700/50 rounded-xl p-5 border border-slate-600/50">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <p className="text-xs text-slate-400 mb-1">Position Address</p>
                                                    <p className="font-mono text-sm text-purple-400 break-all">{position.publicKey.toString()}</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <div>
                                                    <p className="text-xs text-slate-400 mb-1">Liquidity</p>
                                                    <p className="text-sm font-semibold text-green-400">{position.account.liquidity.toString()}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-400 mb-1">Lower Tick</p>
                                                    <p className="text-sm font-semibold text-blue-400">{position.account.tickLower}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-400 mb-1">Upper Tick</p>
                                                    <p className="text-sm font-semibold text-blue-400">{position.account.tickUpper}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-400 mb-1">Pool</p>
                                                    <p className="font-mono text-xs text-slate-200 truncate">{position.account.pool.toString()}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 mt-4">
                                                <button
                                                    onClick={() => {
                                                        setIncreaseLiqForm({ ...increaseLiqForm, positionAddress: position.publicKey.toString() });
                                                    }}
                                                    className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 py-2 rounded-lg transition-all text-sm font-semibold border border-green-500/50"
                                                >
                                                    Increase
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setDecreaseLiqForm({ ...decreaseLiqForm, positionAddress: position.publicKey.toString() });
                                                    }}
                                                    className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 py-2 rounded-lg transition-all text-sm font-semibold border border-red-500/50"
                                                >
                                                    Decrease
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Increase Liquidity Form */}
                        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
                            <h3 className="text-xl font-bold mb-4 text-green-400">Increase Liquidity</h3>
                            <form onSubmit={handleIncreaseLiquidity} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Position Address</label>
                                    <input
                                        type="text"
                                        value={increaseLiqForm.positionAddress}
                                        onChange={(e) => setIncreaseLiqForm({ ...increaseLiqForm, positionAddress: e.target.value })}
                                        className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-green-500 transition-all"
                                        placeholder="Position public key"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Liquidity Amount</label>
                                    <input
                                        type="number"
                                        value={increaseLiqForm.liquidityAmount}
                                        onChange={(e) => setIncreaseLiqForm({ ...increaseLiqForm, liquidityAmount: e.target.value })}
                                        className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-green-500 transition-all"
                                        placeholder="500000"
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={increaseLiquidityHandler.isPending}
                                    className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                                >
                                    {increaseLiquidityHandler.isPending ? 'Processing...' : 'Increase Liquidity'}
                                </button>
                            </form>
                        </div>

                        {/* Decrease Liquidity Form */}
                        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
                            <h3 className="text-xl font-bold mb-4 text-red-400">Decrease Liquidity</h3>
                            <form onSubmit={handleDecreaseLiquidity} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Position Address</label>
                                    <input
                                        type="text"
                                        value={decreaseLiqForm.positionAddress}
                                        onChange={(e) => setDecreaseLiqForm({ ...decreaseLiqForm, positionAddress: e.target.value })}
                                        className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-red-500 transition-all"
                                        placeholder="Position public key"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Liquidity Amount</label>
                                    <input
                                        type="number"
                                        value={decreaseLiqForm.liquidityAmount}
                                        onChange={(e) => setDecreaseLiqForm({ ...decreaseLiqForm, liquidityAmount: e.target.value })}
                                        className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-red-500 transition-all"
                                        placeholder="500000"
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={decreaseLiquidityHandler.isPending}
                                    className="w-full bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                                >
                                    {decreaseLiquidityHandler.isPending ? 'Processing...' : 'Decrease Liquidity'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* Swap Tab */}
                {activeTab === 'swap' && (
                    <div className="max-w-2xl mx-auto">
                        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
                            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                                <span className="text-pink-400">🔄</span> Swap Tokens
                            </h2>
                            <form onSubmit={handleSwap} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Pool Address</label>
                                    <select
                                        value={swapForm.poolAddress}
                                        onChange={(e) => setSwapForm({ ...swapForm, poolAddress: e.target.value })}
                                        className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-pink-500 transition-all"
                                        required
                                    >
                                        <option value="">Select a pool</option>
                                        {poolAccounts.data?.map((pool) => (
                                            <option key={pool.publicKey.toString()} value={pool.publicKey.toString()}>
                                                {pool.publicKey.toString().slice(0, 8)}...{pool.publicKey.toString().slice(-8)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Amount In</label>
                                    <input
                                        type="number"
                                        value={swapForm.amountIn}
                                        onChange={(e) => setSwapForm({ ...swapForm, amountIn: e.target.value })}
                                        className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                                        placeholder="1000"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Swap Direction</label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setSwapForm({ ...swapForm, swapToken0For1: true })}
                                            className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
                                                swapForm.swapToken0For1
                                                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                                                    : 'bg-slate-700/50 text-slate-400 border border-slate-600'
                                            }`}
                                        >
                                            Token 0 → Token 1
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSwapForm({ ...swapForm, swapToken0For1: false })}
                                            className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
                                                !swapForm.swapToken0For1
                                                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                                                    : 'bg-slate-700/50 text-slate-400 border border-slate-600'
                                            }`}
                                        >
                                            Token 1 → Token 0
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Minimum Amount Out (Slippage)</label>
                                    <input
                                        type="number"
                                        value={swapForm.amountOutMinimum}
                                        onChange={(e) => setSwapForm({ ...swapForm, amountOutMinimum: e.target.value })}
                                        className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                                        placeholder="990"
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={swapHandler.isPending}
                                    className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-semibold py-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg text-lg"
                                >
                                    {swapHandler.isPending ? 'Swapping...' : 'Execute Swap'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* Create Tab */}
                {activeTab === 'create' && (
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Initialize Pool */}
                        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
                            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                                <span className="text-blue-400">🏊</span> Create New Pool
                            </h2>
                            <form onSubmit={handleInitializePool} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Token Mint 0</label>
                                    <input
                                        type="text"
                                        value={initPoolForm.tokenMint0}
                                        onChange={(e) => setInitPoolForm({ ...initPoolForm, tokenMint0: e.target.value })}
                                        className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
                                        placeholder="Token 0 public key"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Token Mint 1</label>
                                    <input
                                        type="text"
                                        value={initPoolForm.tokenMint1}
                                        onChange={(e) => setInitPoolForm({ ...initPoolForm, tokenMint1: e.target.value })}
                                        className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
                                        placeholder="Token 1 public key"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Tick Spacing</label>
                                    <input
                                        type="number"
                                        value={initPoolForm.tickSpacing}
                                        onChange={(e) => setInitPoolForm({ ...initPoolForm, tickSpacing: e.target.value })}
                                        className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
                                        placeholder="10"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Initial Sqrt Price</label>
                                    <input
                                        type="text"
                                        value={initPoolForm.initialSqrtPrice}
                                        onChange={(e) => setInitPoolForm({ ...initPoolForm, initialSqrtPrice: e.target.value })}
                                        className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
                                        placeholder="79228162514264337593543950336"
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={initializePoolHandler.isPending}
                                    className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                                >
                                    {initializePoolHandler.isPending ? 'Creating...' : 'Create Pool'}
                                </button>
                            </form>
                        </div>

                        {/* Open Position */}
                        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
                            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                                <span className="text-purple-400">📍</span> Open New Position
                            </h2>
                            <form onSubmit={handleOpenPosition} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Pool Address</label>
                                    <select
                                        value={openPosForm.poolAddress}
                                        onChange={(e) => setOpenPosForm({ ...openPosForm, poolAddress: e.target.value })}
                                        className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-all"
                                        required
                                    >
                                        <option value="">Select a pool</option>
                                        {poolAccounts.data?.map((pool) => (
                                            <option key={pool.publicKey.toString()} value={pool.publicKey.toString()}>
                                                {pool.publicKey.toString().slice(0, 8)}...{pool.publicKey.toString().slice(-8)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">Lower Tick</label>
                                        <input
                                            type="number"
                                            value={openPosForm.lowerTick}
                                            onChange={(e) => setOpenPosForm({ ...openPosForm, lowerTick: e.target.value })}
                                            className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 transition-all"
                                            placeholder="-100"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">Upper Tick</label>
                                        <input
                                            type="number"
                                            value={openPosForm.upperTick}
                                            onChange={(e) => setOpenPosForm({ ...openPosForm, upperTick: e.target.value })}
                                            className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 transition-all"
                                            placeholder="100"
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Liquidity Amount</label>
                                    <input
                                        type="number"
                                        value={openPosForm.liquidityAmount}
                                        onChange={(e) => setOpenPosForm({ ...openPosForm, liquidityAmount: e.target.value })}
                                        className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 transition-all"
                                        placeholder="1000000"
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={openPositionHandler.isPending}
                                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                                >
                                    {openPositionHandler.isPending ? 'Opening...' : 'Open Position'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* Stats Section */}
                <div className="mt-8 grid md:grid-cols-3 gap-6">
                    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
                        <div className="text-slate-400 text-sm mb-2">Total Pools</div>
                        <div className="text-3xl font-bold text-blue-400">{poolAccounts.data?.length || 0}</div>
                    </div>
                    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
                        <div className="text-slate-400 text-sm mb-2">Your Positions</div>
                        <div className="text-3xl font-bold text-purple-400">
                            {positionAccounts.data?.filter(p => p.account.owner.equals(publicKey)).length || 0}
                        </div>
                    </div>
                    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
                        <div className="text-slate-400 text-sm mb-2">Tick Arrays</div>
                        <div className="text-3xl font-bold text-green-400">{tickArrayAccounts.data?.length || 0}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}