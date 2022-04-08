import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import { Dex } from "../src";

describe("Serum Dev Tools", () => {
  const connection = new Connection("http://localhost:8899", "confirmed");
  const owner = Keypair.generate();

  const dexAddress = new PublicKey(
    "7zo7HCQAZPRb4pYiQQ6fLjC8ssN3E8LkavVs8JUA5NMn",
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

  it("can create dex accounts", async () => {
    const market = Keypair.generate();
    const requestQueue = Keypair.generate();
    const eventQueue = Keypair.generate();
    const bids = Keypair.generate();
    const asks = Keypair.generate();

    const sig = await Dex.createAccounts(
      { market, requestQueue, eventQueue, bids, asks },
      owner,
      connection,
      dexAddress,
    );

    expect(sig).toBeTruthy();
  });
});
