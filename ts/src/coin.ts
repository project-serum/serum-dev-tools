import { PublicKey } from "@solana/web3.js";

export interface Coin {
  symbol: string;
  decimals: number;
  mint: PublicKey;
}
