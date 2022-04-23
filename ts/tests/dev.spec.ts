import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import BN from "bn.js";
import { assert } from "chai";
import { Dex } from "../src";

describe("Serum Dev Tools", () => {
  const connection = new Connection("http://localhost:8899", "confirmed");
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
    const coin = await dex.createCoin("SAYA", 6, owner, owner.publicKey, null);

    assert.equal(coin.decimals, 6);
    assert.equal(coin.symbol, "SAYA");
  });

  it("can init dex market", async () => {
    await dex.createCoin("SRM", 6, owner, owner.publicKey, null);

    const dexMarket = await dex.initDexMarket(
      owner,
      dex.getCoin("SAYA"),
      dex.getCoin("SRM"),
      {
        tickSize: 0.001,
        lotSize: 10,
        feeRate: 10,
        quoteDustThreshold: new BN(100),
      },
    );

    assert.equal(
      dexMarket.address.toBase58(),
      dexMarket.serumMarket.address.toBase58(),
    );
  });
});
