// Here we export some useful types and functions for interacting with the Anchor program.
import { AnchorProvider, Program } from '@coral-xyz/anchor'
import { Cluster, PublicKey } from '@solana/web3.js'
import ClmmIDL from '../target/idl/clmm.json'
import type { Clmm } from '../target/types/clmm'

// Re-export the generated IDL and type
export { Clmm, ClmmIDL }

// The programId is imported from the program IDL.
export const CLMM_PROGRAM_ID = new PublicKey(ClmmIDL.address)

// This is a helper function to get the Counter Anchor program.
export function getClmmProgram(provider: AnchorProvider, address?: PublicKey): Program<Clmm> {
  return new Program({ ...ClmmIDL, address: address ? address.toBase58() : ClmmIDL.address } as Clmm, provider)
}

// This is a helper function to get the program ID for the Counter program depending on the cluster.
export function getClmmProgramId(cluster: Cluster) {
  switch (cluster) {
    case 'devnet':
    case 'testnet':
      // This is the program ID for the Counter program on devnet and testnet.
      return new PublicKey('2T8KvHs6Q881FpnC2BZc7g9G5jpHw5ujdcZLHmLfSZLr')
    case 'mainnet-beta':
    default:
      return CLMM_PROGRAM_ID
  }
}
