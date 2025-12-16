"use client"
import { useWallet } from "@solana/wallet-adapter-react"
import { useClmmProgram } from "./clmm-data-access";
import { WalletButton } from "../solana/solana-provider";
import { BN } from "bn.js";
import { useState } from "react";
import { PublicKey } from "@solana/web3.js";

export default function Clmm() {
    const { publicKey } = useWallet();
    const { initializePoolHandler, increaseLiquidityHandler, openPositionHandler, decreaseLiquidityHandler, swapHandler, poolAccounts, positionAccounts, tickArrayAccounts } = useClmmProgram();
    const [activeTab, setActiveTab] = useState<'pools' | 'positions' | 'create'>('pools');
    
    // Initialize Pool Form State
    const [initPoolForm, setInitPoolForm] = useState({
        tokenMint0: '',
        tokenMint1: '',
        tickSpacing: '10',
        initialSqrtPrice: '79228162514264337593543950336' // 2^96
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
            <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4">
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-slate-700">
                    <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                        CLMM Protocol
                    </h1>
                    <p className="text-slate-300 mb-6">Connect your wallet to get started</p>
                    <WalletButton />
                </div>
            </div>
        );
    }


    return <div>
        <h1>CLMM</h1>
    </div>
}