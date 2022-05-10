import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { assert } from "chai";
import { Coin, Dex, FileKeypair } from "../src";

describe("Serum Dev Tools", () => {
  const connection = new Connection("http://localhost:8899", "confirmed");
  const owner = FileKeypair.generate("./tests/keys/owner.json");

  const dexAddress = new PublicKey(
    "7zo7HCQAZPRb4pYiQQ6fLjC8ssN3E8LkavVs8JUA5NMn",
  );

  const dex = new Dex(dexAddress, connection);

  let baseCoin: Coin;
  let quoteCoin: Coin;

  before(async () => {
    const sig = await connection.requestAirdrop(
      owner.keypair.publicKey,
      20 * LAMPORTS_PER_SOL,
    );
    await connection.confirmTransaction(sig);
  });

  it("can create coins", async () => {
    baseCoin = await dex.createCoin(
      "SAYA",
      9,
      owner.keypair,
      owner.keypair,
      owner.keypair,
    );
    quoteCoin = await dex.createCoin(
      "SRM",
      9,
      owner.keypair,
      owner.keypair,
      owner.keypair,
    );

    assert.equal(baseCoin.decimals, 9);
    assert.equal(baseCoin.symbol, "SAYA");

    assert.equal(quoteCoin.decimals, 9);
    assert.equal(quoteCoin.symbol, "SRM");
  });

  it("can init dex market", async () => {
    const dexMarket = await dex.initDexMarket(
      owner.keypair,
      dex.getCoin("SAYA"),
      dex.getCoin("SRM"),
      {
        lotSize: 1e-3,
        tickSize: 1e-2,
        feeRate: 10,
        quoteDustThreshold: new BN(100),
      },
    );

    assert.equal(
      dexMarket.address.toBase58(),
      dexMarket.serumMarket.address.toBase58(),
    );
  });

  it("can fund token accounts", async () => {
    await baseCoin.fundAccount(1e6, owner.keypair, connection);
    await quoteCoin.fundAccount(2e6, owner.keypair, connection);

    const baseBalance = await baseCoin.getBalance(owner.keypair, connection);
    const quoteBalance = await quoteCoin.getBalance(owner.keypair, connection);

    assert.equal(baseBalance.value.uiAmount, 1e6);
    assert.equal(quoteBalance.value.uiAmount, 2e6);
  });
});
