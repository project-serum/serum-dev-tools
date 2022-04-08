import {
  clusterApiUrl,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import BN from "bn.js";
import { assert } from "chai";
import { Dex } from "../src";

describe("Serum Dev Tools", () => {
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  const owner = Keypair.generate();

  const dexAddress = new PublicKey(
    "7zo7HCQAZPRb4pYiQQ6fLjC8ssN3E8LkavVs8JUA5NMn",
  );

  const dex = new Dex(dexAddress, connection);

  before(async () => {
    const sig = await connection.requestAirdrop(
      owner.publicKey,
      20 * LAMPORTS_PER_SOL,
    );
    await connection.confirmTransaction(sig);

    console.log(await connection.getBalance(owner.publicKey, "confirmed"));
  });

  it("can create coin", async () => {
    const mint = await dex.createCoin("SAYA", 6, owner, owner.publicKey, null);

    const coin = dex.getCoin("SAYA");

    assert.equal(coin.mint, mint);
  });

  it("can create dex accounts", async () => {
    await dex.createCoin("SRM", 6, owner, owner.publicKey, null);

    const dexMarket = await dex.initDexMarket(
      dex.getCoin("SAYA"),
      dex.getCoin("SRM"),
      {
        tickSize: 0.001,
        lotSize: 10,
        feeRate: 10,
        quoteDustThreshold: new BN(100),
      },
      owner,
    );

    assert.equal(
      dexMarket.address.toBase58(),
      dexMarket.serumMarket.address.toBase58(),
    );
  });
});
