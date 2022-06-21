import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { Coin, Dex, DexMarket, FileKeypair } from "../src";

describe("Serum Dev Tools", () => {
  const connection = new Connection("http://localhost:8899", "confirmed");
  const owner = FileKeypair.generate("./tests/keys/owner.json");

  const dexAddress = new PublicKey(
    "7zo7HCQAZPRb4pYiQQ6fLjC8ssN3E8LkavVs8JUA5NMn",
  );

  const dex = new Dex(dexAddress, connection);
  let dexMarket: DexMarket;

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
    dexMarket = await dex.initDexMarket(owner.keypair, baseCoin, quoteCoin, {
      lotSize: 1e-3,
      tickSize: 1e-2,
    });

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

  it("can place orders", async () => {
    await DexMarket.placeOrder(
      connection,
      owner.keypair,
      dexMarket.serumMarket,
      "buy",
      "postOnly",
      10,
      10,
    );

    const orders = await dexMarket.serumMarket.loadOrdersForOwner(
      connection,
      owner.keypair.publicKey,
    );

    assert.equal(orders.length, 1);
    assert.equal(orders[0].price, 10);
    assert.equal(orders[0].size, 10);
    assert.equal(orders[0].side, "buy");
  });

  it("can load coins", async () => {
    const tempCoin = await dex.createCoin(
      "test",
      9,
      owner.keypair,
      owner.keypair,
      null,
    );

    const loadedCoin = await Coin.load(
      connection,
      "test-2",
      tempCoin.mint,
      owner.keypair,
      null,
    );

    assert.equal(tempCoin.decimals, loadedCoin.decimals);
  });

  it("invalid freeze authority while load coins", async () => {
    const tempCoin = await dex.createCoin(
      "test",
      9,
      owner.keypair,
      owner.keypair,
      owner.keypair,
    );

    try {
      await Coin.load(connection, "test", tempCoin.mint, owner.keypair, null);
    } catch (err) {
      assert.ok(true);
    }
  });
});
