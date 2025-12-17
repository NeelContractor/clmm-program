"use client"
import { useClmmProgram } from "@/components/clmm/clmm-data-access";
import { WalletButton } from "@/components/solana/solana-provider";
import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";

export default function Page() {
    const { publicKey } = useWallet();
    const { positionAccounts } = useClmmProgram();

    return (
        <div className="min-h-screen bg-black p-8 font-mono">
            <div className="max-w-3xl mx-auto">
                <div className="bg-zinc-900 border-2 border-white rounded-2xl shadow-2xl p-8">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-4xl font-bold text-white mb-2">DASHBOARD</h1>
                        <p className="text-gray-400">MANAGE YOUR POSITIONS</p>
                    </div>
            
                    <div className='flex justify-between p-2 mb-6'>
                        <Link href={"/"} className='bg-red-500 text-white rounded-xl px-5 py-2 hover:bg-red-600 transition-colors font-bold'>
                            ← BACK
                        </Link>
                        <div className='flex justify-center'>
                            <WalletButton />
                        </div>
                    </div>
            
                    <div>
                        {positionAccounts.data?.map((position) => (
                            <div key={position.publicKey.toString()} className="bg-black border-2 border-white rounded-2xl p-6 hover:border-green-500 transition-all transform hover:scale-[1.01]">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xs font-bold text-black bg-green-500 px-3 py-1 rounded-full">POSITIONS</span>
                                        </div>
                                        {/* <p className="font-mono text-sm text-gray-400 break-all bg-zinc-900 px-3 py-2 rounded-lg">{position.publicKey.toString()}</p> */}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="bg-zinc-900 rounded-xl p-3 border border-white">
                                        <p className="text-xs text-gray-500 mb-1 font-semibold">POOL ID</p>
                                        <p className="font-mono text-xs text-white truncate">{position.account.pool.toBase58()}</p>
                                    </div>
                                    <div className="bg-zinc-900 rounded-xl p-3 border border-white">
                                        <p className="text-xs text-gray-500 mb-1 font-semibold">LIQUIDITY</p>
                                        <p className="font-mono text-xs text-white truncate">{position.account.liquidity.toNumber()}</p>
                                    </div>
                                    <div className="bg-zinc-900 rounded-xl p-3 border border-white">
                                        <p className="text-xs text-gray-500 mb-1 font-semibold">UPPER TICK</p>
                                        <p className="text-sm font-bold text-white">{position.account.tickUpper}</p>
                                    </div>
                                    <div className="bg-zinc-900 rounded-xl p-3 border border-white">
                                        <p className="text-xs text-gray-500 mb-1 font-semibold">LOWER TICK</p>
                                        <p className="text-sm font-bold text-white">{position.account.tickLower}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                </div>
            </div>
        </div>
    );
}