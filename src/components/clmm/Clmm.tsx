"use client"

import { useWallet } from "@solana/wallet-adapter-react"
import { useClmmProgram } from "./clmm-data-access";
import { WalletButton } from "../solana/solana-provider";
import { BN } from "bn.js";
import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import Link from "next/link";

const ADMIN_PUBKEY = new PublicKey("GToMxgF4JcNn8dmNiHt2JrrvLaW6S1zSPoL2W8K2Wkmi");

// TODO: probably change input logic to shadcn input/ selector

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
    
    const [initPoolForm, setInitPoolForm] = useState({
        tokenMint0: '',
        tokenMint1: '',
        tickSpacing: '10',
        initialSqrtPrice: '79228162514264337593543950336'
    });

    const [openPosForm, setOpenPosForm] = useState({
        poolAddress: '',
        lowerTick: '-100',
        upperTick: '100',
        liquidityAmount: '1000000'
    });

    const [increaseLiqForm, setIncreaseLiqForm] = useState({
        positionAddress: '',
        liquidityAmount: '500000'
    });

    const [decreaseLiqForm, setDecreaseLiqForm] = useState({
        positionAddress: '',
        liquidityAmount: '500000'
    });

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
            <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4 font-mono">
                <div className="bg-zinc-900 border-2 border-white rounded-2xl p-12 shadow-2xl max-w-md w-full">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center p-5 bg-green-500/20 rounded-2xl mb-6 border-2 border-green-500">
                            <svg className="w-20 h-20 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <h1 className="text-6xl font-extrabold mb-4 text-white">
                            CLMM
                        </h1>
                        <p className="text-gray-400 text-xl font-medium">CONCENTRATED LIQUIDITY MARKET MAKER</p>
                        <div className="mt-4 h-1 w-32 mx-auto bg-green-500 rounded-full"></div>
                    </div>
                    <p className="text-gray-500 mb-8 text-center text-lg">CONNECT WALLET TO ACCESS POOLS</p>
                    <div className="flex justify-center">
                        <WalletButton />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white p-4 sm:p-6 lg:p-8 font-mono">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-center mb-10 gap-4">
                    <div className="text-center sm:text-left">
                        <h1 className="text-5xl font-extrabold text-white mb-2">
                            CLMM PROTOCOL
                        </h1>
                        <p className="text-gray-500 text-lg">MANAGE LIQUDITY POSITIONS</p>
                    </div>
                    
                    <div className="flex flex-wrap justify-center gap-3 items-center">
                        {publicKey.equals(ADMIN_PUBKEY) && (
                            <Link href="/create" className="px-5 py-2.5 bg-red-500 hover:bg-red-600 rounded-xl font-semibold transition-all border-2 border-red-500 hover:border-red-400 text-white">
                                CREATE MINT
                            </Link>
                        )}
                        
                        <Link href="/dashboard" className="px-5 py-2.5 bg-green-400 hover:bg-green-600 text-black rounded-xl font-semibold transition-all border-2 border-green-500">
                            DASHBOARD
                        </Link>

                        <Link href="/mint" className="px-5 py-2.5 bg-white hover:bg-gray-200 text-black rounded-xl font-semibold transition-all border-2 border-white">
                            MINT TOKENS
                        </Link>
                        
                        <WalletButton />
                    </div>
                </div>

                {/* Stats Cards - Moved to top */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                    <div className="bg-zinc-900 border-2 border-white rounded-2xl p-6 hover:border-green-500 transition-all transform hover:scale-[1.02]">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-gray-500 text-sm mb-1 font-medium">TOTAL POOLS</div>
                                <div className="text-4xl font-extrabold text-white">{poolAccounts.data?.length || 0}</div>
                            </div>
                            <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center border-2 border-green-500">
                                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                                </svg>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-zinc-900 border-2 border-white rounded-2xl p-6 hover:border-white transition-all transform hover:scale-[1.02]">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-gray-500 text-sm mb-1 font-medium">YOUR POSITIONS</div>
                                <div className="text-4xl font-extrabold text-white">
                                    {positionAccounts.data?.filter(p => p.account.owner.equals(publicKey)).length || 0}
                                </div>
                            </div>
                            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center border-2 border-white">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-zinc-900 border-2 border-white rounded-2xl p-6 hover:border-white transition-all transform hover:scale-[1.02]">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-gray-500 text-sm mb-1 font-medium">TICK ARRAYS</div>
                                <div className="text-4xl font-extrabold text-white">{tickArrayAccounts.data?.length || 0}</div>
                            </div>
                            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center border-2 border-white">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex flex-wrap gap-3 mb-8 bg-zinc-900 border-2 border-white p-2 rounded-2xl">
                    {(['pools', 'positions', 'swap', 'create'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 min-w-[120px] py-3 px-6 rounded-xl font-bold transition-all duration-300 ${
                                activeTab === tab
                                    ? 'bg-green-500 text-black shadow-lg transform scale-105'
                                    : 'text-gray-400 hover:text-white hover:bg-zinc-800'
                            }`}
                        >
                            {tab.toUpperCase()}
                        </button>
                    ))}
                </div>

                {/* Pools Tab */}
                {activeTab === 'pools' && (
                    <div className="space-y-6">
                        <div className="bg-zinc-900 border-2 border-white rounded-3xl p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-12 h-12 bg-green-500/20 rounded-2xl flex items-center justify-center border-2 border-green-500">
                                    <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                                    </svg>
                                </div>
                                <h2 className="text-3xl font-extrabold">ACTIVE POOLS</h2>
                            </div>
                            {poolAccounts.isLoading ? (
                                <div className="text-center py-12">
                                    <div className="inline-block w-12 h-12 border-4 border-zinc-800 border-t-green-500 rounded-full animate-spin"></div>
                                    <p className="mt-4 text-gray-500">Loading pools...</p>
                                </div>
                            ) : poolAccounts.data?.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                        </svg>
                                    </div>
                                    <p className="text-gray-500 text-lg">No pools found</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {poolAccounts.data?.map((pool) => (
                                        <div key={pool.publicKey.toString()} className="bg-black border-2 border-white rounded-2xl p-6 hover:border-green-500 transition-all transform hover:scale-[1.01]">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="text-xs font-bold text-black bg-green-500 px-3 py-1 rounded-full">POOL</span>
                                                    </div>
                                                    <p className="font-mono text-sm text-gray-400 break-all bg-zinc-900 px-3 py-2 rounded-lg">{pool.publicKey.toString()}</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                                <div className="bg-zinc-900 rounded-xl p-3 border border-white">
                                                    <p className="text-xs text-gray-500 mb-1 font-semibold">TOKEN 0</p>
                                                    <p className="font-mono text-xs text-white truncate">{pool.account.tokenMint0.toString()}</p>
                                                </div>
                                                <div className="bg-zinc-900 rounded-xl p-3 border border-white">
                                                    <p className="text-xs text-gray-500 mb-1 font-semibold">TOKEN 1</p>
                                                    <p className="font-mono text-xs text-white truncate">{pool.account.tokenMint1.toString()}</p>
                                                </div>
                                                <div className="bg-zinc-900 rounded-xl p-3 border border-white">
                                                    <p className="text-xs text-gray-500 mb-1 font-semibold">LIQUIDITY</p>
                                                    <p className="text-sm font-bold text-green-500">{pool.account.globalLiquidity.toString()}</p>
                                                </div>
                                                <div className="bg-zinc-900 rounded-xl p-3 border border-white">
                                                    <p className="text-xs text-gray-500 mb-1 font-semibold">CURRENT TICK</p>
                                                    <p className="text-sm font-bold text-white">{pool.account.currentTick}</p>
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
                        <div className="bg-zinc-900 border-2 border-white rounded-2xl p-6">
                            <h2 className="text-2xl font-bold mb-4">YOUR POSITIONS</h2>
                            {positionAccounts.isLoading ? (
                                <div className="text-center py-8 text-zinc-500">Loading...</div>
                            ) : positionAccounts.data?.filter(p => p.account.owner.equals(publicKey))?.length === 0 ? (
                                <div className="text-center py-8 text-zinc-500">No positions found</div>
                            ) : (
                                <div className="space-y-4">
                                    {positionAccounts.data?.filter(p => p.account.owner.equals(publicKey)).map((position) => (
                                        <div key={position.publicKey.toString()} className="bg-black border-2 border-white rounded-xl p-5">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-1">POSITION</p>
                                                    <p className="font-mono text-sm text-gray-400 break-all">{position.publicKey.toString()}</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-1">LIQUIDITY</p>
                                                    <p className="text-sm font-semibold text-green-500">{position.account.liquidity.toString()}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-1">LOWER TICK</p>
                                                    <p className="text-sm font-semibold text-white">{position.account.tickLower}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-1">UPPER TICK</p>
                                                    <p className="text-sm font-semibold text-white">{position.account.tickUpper}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-1">POOL</p>
                                                    <p className="font-mono text-xs text-gray-400 truncate">{position.account.pool.toString()}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 mt-4">
                                                <button
                                                    onClick={() => setIncreaseLiqForm({ ...increaseLiqForm, positionAddress: position.publicKey.toString() })}
                                                    className="flex-1 bg-green-500 hover:bg-green-400 text-black py-2 rounded-lg transition-all text-sm font-semibold"
                                                >
                                                    INCREASE
                                                </button>
                                                <button
                                                    onClick={() => setDecreaseLiqForm({ ...decreaseLiqForm, positionAddress: position.publicKey.toString() })}
                                                    className="flex-1 bg-red-500 hover:bg-red-400 text-white py-2 rounded-lg transition-all text-sm font-semibold"
                                                >
                                                    DECREASE
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Increase Form */}
                        <div className="bg-zinc-900 border-2 border-white rounded-2xl p-6">
                            <h3 className="text-xl font-bold mb-4 text-white">INCREASE LIQUIDITY</h3>
                            <form onSubmit={handleIncreaseLiquidity} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">POSITION ADDRESS</label>
                                    <input
                                        type="text"
                                        value={increaseLiqForm.positionAddress}
                                        onChange={(e) => setIncreaseLiqForm({ ...increaseLiqForm, positionAddress: e.target.value })}
                                        className="w-full bg-black border-2 border-white rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition-all"
                                        placeholder="Position public key"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">LIQUIDITY AMOUNT</label>
                                    <input
                                        type="number"
                                        value={increaseLiqForm.liquidityAmount}
                                        onChange={(e) => setIncreaseLiqForm({ ...increaseLiqForm, liquidityAmount: e.target.value })}
                                        className="w-full bg-black border-2 border-white rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition-all"
                                        placeholder="500000"
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={increaseLiquidityHandler.isPending}
                                    className="w-full bg-green-500 hover:bg-green-400 text-black font-bold py-3 rounded-lg transition-all disabled:opacity-50"
                                >
                                    {increaseLiquidityHandler.isPending ? 'PROCESSING...' : 'INCREASE'}
                                </button>
                            </form>
                        </div>

                        {/* Decrease Form */}
                        <div className="bg-zinc-900 border-2 border-red-500 rounded-2xl p-6">
                            <h3 className="text-xl font-bold mb-4 text-red-500">DECREASE LIQUIDITY</h3>
                            <form onSubmit={handleDecreaseLiquidity} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">POSITION ADDRESS</label>
                                    <input
                                        type="text"
                                        value={decreaseLiqForm.positionAddress}
                                        onChange={(e) => setDecreaseLiqForm({ ...decreaseLiqForm, positionAddress: e.target.value })}
                                        className="w-full bg-black border-2 border-white rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 transition-all"
                                        placeholder="Position public key"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">LIQUIDITY AMOUNT</label>
                                    <input
                                        type="number"
                                        value={decreaseLiqForm.liquidityAmount}
                                        onChange={(e) => setDecreaseLiqForm({ ...decreaseLiqForm, liquidityAmount: e.target.value })}
                                        className="w-full bg-black border-2 border-white rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 transition-all"
                                        placeholder="500000"
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={decreaseLiquidityHandler.isPending}
                                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-red-900/30 disabled:opacity-50"
                                >
                                    {decreaseLiquidityHandler.isPending ? 'PROCESSING...' : 'DECREASE'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* Swap Tab */}
                {activeTab === 'swap' && (
                    <div className="max-w-2xl mx-auto">
                        <div className="bg-zinc-900 border-2 border-white rounded-2xl p-6">
                            <h2 className="text-2xl font-bold mb-4">SWAP TOKENS</h2>
                            <form onSubmit={handleSwap} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">POOL ADDRESS</label>
                                    <select
                                        value={swapForm.poolAddress}
                                        onChange={(e) => setSwapForm({ ...swapForm, poolAddress: e.target.value })}
                                        className="w-full bg-black border-2 border-white rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition-all"
                                        required
                                    >
                                        <option value="">Select pool</option>
                                        {poolAccounts.data?.map((pool) => ( 
                                            <option key={pool.publicKey.toString()} value={pool.publicKey.toString()}>
                                                {pool.publicKey.toString().slice(0, 8)}...{pool.publicKey.toString().slice(-8)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">AMOUNT IN</label>
                                    <input
                                        type="number"
                                        value={swapForm.amountIn}
                                        onChange={(e) => setSwapForm({ ...swapForm, amountIn: e.target.value })}
                                        className="w-full bg-black border-2 border-white rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition-all"
                                        placeholder="1000"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">DIRECTION</label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setSwapForm({ ...swapForm, swapToken0For1: true })}
                                            className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
                                                swapForm.swapToken0For1
                                                    ? 'bg-red-600 text-white'
                                                    : 'bg-black/50 text-zinc-400 border border-zinc-800'
                                            }`}
                                        >
                                            Token 0 → 1
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSwapForm({ ...swapForm, swapToken0For1: false })}
                                            className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
                                                !swapForm.swapToken0For1
                                                    ? 'bg-red-600 text-white'
                                                    : 'bg-black/50 text-zinc-400 border border-zinc-800'
                                            }`}
                                        >
                                            Token 1 → 0
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">MIN AMOUNT OUT</label>
                                    <input
                                        type="number"
                                        value={swapForm.amountOutMinimum}
                                        onChange={(e) => setSwapForm({ ...swapForm, amountOutMinimum: e.target.value })}
                                        className="w-full bg-black border-2 border-white rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition-all"
                                        placeholder="990"
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={swapHandler.isPending}
                                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-lg transition-all shadow-lg shadow-red-900/30 disabled:opacity-50 text-lg"
                                >
                                    {swapHandler.isPending ? 'SWAPPING...' : 'SWAP'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* Create Tab */}
                {activeTab === 'create' && (
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Initialize Pool */}
                        <div className="bg-zinc-900 border-2 border-white rounded-2xl p-6">
                            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                                CREATE NEW POOL
                            </h2>
                            <form onSubmit={handleInitializePool} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">TOKEN MINT 0</label>
                                    <input
                                        type="text"
                                        value={initPoolForm.tokenMint0}
                                        onChange={(e) => setInitPoolForm({ ...initPoolForm, tokenMint0: e.target.value })}
                                        className="w-full bg-black border-2 border-white rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition-all"
                                        placeholder="Token 0 public key"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">TOKEN MINT 1</label>
                                    <input
                                        type="text"
                                        value={initPoolForm.tokenMint1}
                                        onChange={(e) => setInitPoolForm({ ...initPoolForm, tokenMint1: e.target.value })}
                                        className="w-full bg-black border-2 border-white rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition-all"
                                        placeholder="Token 1 public key"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">TICK SPACING</label>
                                    <input
                                        type="number"
                                        value={initPoolForm.tickSpacing}
                                        onChange={(e) => setInitPoolForm({ ...initPoolForm, tickSpacing: e.target.value })}
                                        className="w-full bg-black border-2 border-white rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition-all"
                                        placeholder="10"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">INITIAL SQRT PRICE</label>
                                    <input
                                        type="text" // TODO: change this to number so the input takes number only and then convert it to string
                                        value={initPoolForm.initialSqrtPrice}
                                        onChange={(e) => setInitPoolForm({ ...initPoolForm, initialSqrtPrice: e.target.value })}
                                        className="w-full bg-black border-2 border-white rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition-all"
                                        placeholder="79228162514264337593543950336"
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={initializePoolHandler.isPending}
                                    className="w-full bg-gradient-to-r bg-green-500 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                                >
                                    {initializePoolHandler.isPending ? 'CREATING...' : 'CREATE POOL'}
                                </button>
                            </form>
                        </div>

                        {/* Open Position */}
                        <div className="bg-zinc-900 border-2 border-white rounded-2xl p-6">
                            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                                OPEN NEW POSITION
                            </h2>
                            <form onSubmit={handleOpenPosition} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">POOL ADDRESS</label>
                                    <select
                                        value={openPosForm.poolAddress}
                                        onChange={(e) => setOpenPosForm({ ...openPosForm, poolAddress: e.target.value })}
                                        className="w-full bg-black border-2 border-white rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition-all"
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
                                        <label className="block text-sm font-medium text-gray-400 mb-2">LOWER TICK</label>
                                        <input
                                            type="number"
                                            value={openPosForm.lowerTick}
                                            onChange={(e) => setOpenPosForm({ ...openPosForm, lowerTick: e.target.value })}
                                            className="w-full bg-black border-2 border-white rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition-all"
                                            placeholder="-100"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">UPPER TICK</label>
                                        <input
                                            type="number"
                                            value={openPosForm.upperTick}
                                            onChange={(e) => setOpenPosForm({ ...openPosForm, upperTick: e.target.value })}
                                            className="w-full bg-black border-2 border-white rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition-all"
                                            placeholder="100"
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">LIQUIDITY AMOUNT</label>
                                    <input
                                        type="number"
                                        value={openPosForm.liquidityAmount}
                                        onChange={(e) => setOpenPosForm({ ...openPosForm, liquidityAmount: e.target.value })}
                                        className="w-full bg-black border-2 border-white rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition-all"
                                        placeholder="1000000"
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={openPositionHandler.isPending}
                                    className="w-full bg-gradient-to-r bg-green-500 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                                >
                                    {openPositionHandler.isPending ? 'OPENING...' : 'OPEN POSITION'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* Stats Section */}
                <div className="mt-8 grid md:grid-cols-3 gap-6">
                    <div className="bg-zinc-900 border-2 border-white rounded-2xl p-6 transition-all transform hover:scale-[1.02]">
                        <div className="text-slate-400 text-sm mb-2">TOTAL POOLS</div>
                        <div className="text-3xl font-bold text-blue-400">{poolAccounts.data?.length || 0}</div>
                    </div>
                    <div className="bg-zinc-900 border-2 border-white rounded-2xl p-6 transition-all transform hover:scale-[1.02]">
                        <div className="text-slate-400 text-sm mb-2">YOUR POSITIONS</div>
                        <div className="text-3xl font-bold text-purple-400">
                            {positionAccounts.data?.filter(p => p.account.owner.equals(publicKey)).length || 0}
                        </div>
                    </div>
                    <div className="bg-zinc-900 border-2 border-white rounded-2xl p-6 transition-all transform hover:scale-[1.02]">
                        <div className="text-slate-400 text-sm mb-2">TICK ARRAYS</div>
                        <div className="text-3xl font-bold text-green-400">{tickArrayAccounts.data?.length || 0}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}