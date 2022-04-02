import { PublicKey } from "@solana/web3.js";
export class Dex {
  public address: PublicKey;

  constructor(address: PublicKey) {
    this.address = address;
  }

  public hello_world(x: number): string {
    const c = x + 10;
    return `hello ${c}`;
  }
}
