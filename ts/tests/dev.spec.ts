import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import { Dex } from "../src/dex";

describe("Serum Dev Tools", () => {
  const connection = new Connection("http://localhost:8899", "confirmed");
  const owner = Keypair.generate();

  const dexAddress = new PublicKey(
    "8mdYjA9qo2qN5s8TF7gQvkFtijjxBtcYw6vCiPuyeNq7",
  );

  const dex = new Dex(dexAddress, connection);

  beforeAll(async () => {
    const tx = await connection.requestAirdrop(
      owner.publicKey,
      5 * LAMPORTS_PER_SOL,
    );
    await connection.confirmTransaction(tx);
  });

  it("can create coin", async () => {
    const mint = await dex.createCoin("SAYA", 6, owner, owner.publicKey, null);

    const coin = dex.getCoin("SAYA");

    expect(coin.symbol).toBe("SAYA");
    expect(coin.decimals).toBe(6);
    expect(coin.mint).toBe(mint);
  });
});
