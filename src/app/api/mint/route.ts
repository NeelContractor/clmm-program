import { NextResponse } from "next/server"
import { Connection, Keypair, PublicKey } from "@solana/web3.js"
import {
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token"

const connection = new Connection("https://api.devnet.solana.com")

const MINT_AUTHORITY = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(process.env.NEXT_PUBLIC_MINT_AUTHORITY_KEYPAIR!))
)

export async function POST(req: Request) {
  try {
    const { mint, destination, amount } = await req.json()

    const mintPk = new PublicKey(mint)
    const destPk = new PublicKey(destination)

    const ata = await getOrCreateAssociatedTokenAccount(
      connection,
      MINT_AUTHORITY,
      mintPk,
      destPk
    )

    const sig = await mintTo(
      connection,
      MINT_AUTHORITY,
      mintPk,
      ata.address,
      MINT_AUTHORITY,
      BigInt(amount)
    )

    return NextResponse.json({ signature: sig })
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: 500 }
    )
  }
}
