import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  RpcResponseAndContext,
  TokenAmount,
} from "@solana/web3.js";

export class Coin {
  symbol: string;

  decimals: number;

  mint: PublicKey;

  mintAuthority: Keypair;

  freezeAuthority: Keypair;

  constructor(
    symbol: string,
    decimals: number,
    mint: PublicKey,
    mintAuthority: Keypair,
    freezeAuthority: Keypair,
  ) {
    this.symbol = symbol;
    this.decimals = decimals;
    this.mint = mint;
    this.mintAuthority = mintAuthority;
    this.freezeAuthority = freezeAuthority;
  }

  public async getBalance(
    owner: Keypair,
    connection: Connection,
  ): Promise<RpcResponseAndContext<TokenAmount>> {
    const ata = await getOrCreateAssociatedTokenAccount(
      connection,
      owner,
      this.mint,
      owner.publicKey,
      true,
      "confirmed",
    );

    const tokenAmount = await connection.getTokenAccountBalance(
      ata.address,
      "confirmed",
    );

    return tokenAmount;
  }

  public async fundAccount(
    decimalAmount: number,
    owner: Keypair,
    connection: Connection,
  ): Promise<void> {
    const destination = await getOrCreateAssociatedTokenAccount(
      connection,
      owner,
      this.mint,
      owner.publicKey,
      true,
      "confirmed",
    );

    const atomicAmount = BigInt(decimalAmount * 10 ** this.decimals);

    const txSig = await mintTo(
      connection,
      owner,
      this.mint,
      destination.address,
      this.mintAuthority,
      atomicAmount,
    );

    await connection.confirmTransaction(txSig);
  }
}
