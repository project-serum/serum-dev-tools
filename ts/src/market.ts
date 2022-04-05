import { Market } from "@project-serum/serum";
import { PublicKey } from "@solana/web3.js";

export class DexMarket {
  public address: PublicKey;

  public market: Market;

  constructor(address: PublicKey, market: Market) {
    this.address = address;
    this.market = market;
  }
}
