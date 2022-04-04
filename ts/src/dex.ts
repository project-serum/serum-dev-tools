import { createMint } from "@solana/spl-token";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Coin } from "./coin";
export class Dex {
  public address: PublicKey;

  public coins: Coin[];

  connection: Connection;

  constructor(address: PublicKey, connection: Connection) {
    this.address = address;
    this.connection = connection;
    this.coins = [];
  }

  public createCoin = async (
    symbol: string,
    decimals: number,
    payer: Keypair,
    mintAuthority: PublicKey | null,
    freezeAuthority: PublicKey | null,
  ): Promise<PublicKey> => {
    const mint = await createMint(
      this.connection,
      payer,
      mintAuthority,
      freezeAuthority,
      decimals,
    );
    this.coins.push({
      symbol,
      decimals,
      mint,
    });

    return mint;
  };

  public getCoin(symbol: string): Coin | null {
    const coin = this.coins.find((coin) => coin.symbol === symbol);

    return coin ? coin : null;
  }
}
