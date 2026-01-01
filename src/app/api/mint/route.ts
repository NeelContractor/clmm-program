import { NextResponse } from "next/server"
import { Connection, Keypair, PublicKey } from "@solana/web3.js"
import {
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token"

const connection = new Connection("https://api.devnet.solana.com")

// const MINT_AUTHORITY = Keypair.fromSecretKey(
//   Uint8Array.from(JSON.parse(process.env.MINT_AUTHORITY_KEYPAIR!))
// )
function getMintAuthority(): Keypair {
    const raw = process.env.MINT_AUTHORITY_KEYPAIR;
  
    if (!raw) {
        throw new Error("MINT_AUTHORITY_KEYPAIR env var missing");
    }
  
    const secret = Uint8Array.from(JSON.parse(raw));
  
    if (secret.length !== 64) {
        throw new Error(
            `Invalid mint authority key length: ${secret.length} (expected 64)`
        );
    }
  
    return Keypair.fromSecretKey(secret);
}

export async function POST(req: Request) {
  try {
    const { mint, destination, amount } = await req.json()

    const mintAuthority = getMintAuthority();

    const mintPk = new PublicKey(mint)
    const destPk = new PublicKey(destination)

    const ata = await getOrCreateAssociatedTokenAccount(
      connection,
      mintAuthority,
      mintPk,
      destPk
    )

    const sig = await mintTo(
      connection,
      mintAuthority,
      mintPk,
      ata.address,
      mintAuthority,
      amount
    )

    return NextResponse.json({ signature: sig })
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: 500 }
    )
  }
}
