import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import { Dex, DexMarket } from "../src";

describe("Serum Dev Tools", () => {
  const connection = new Connection("http://localhost:8899", "confirmed");
  const owner = Keypair.generate();

  const dexAddress = new PublicKey(
    "9nLpw97GE7mPk5eqUoPfkUYvwtAXbgAoh1H5Ec8miGwM",
  );

  const dex = new Dex(dexAddress, connection);

  beforeAll(async () => {
    const tx = await connection.requestAirdrop(
      owner.publicKey,
      20 * LAMPORTS_PER_SOL,
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

    await DexMarket.createMarketAccounts(
      { market, requestQueue, eventQueue, bids, asks },
      owner,
      connection,
      dexAddress,
    );

    await dex.createCoin("SRM", 6, owner, owner.publicKey, null);

    const dexMarket = await dex.initDexMarket(
      dex.getCoin("SAYA"),
      dex.getCoin("SRM"),
      {
        baseLotSize: 10,
        quoteLotSize: 10,
        feeRate: 10,
        quoteDustThreshold: 10,
      },
      owner,
    );

    expect(dexMarket.address.toBase58()).toBe(
      dexMarket.serumMarket.address.toBase58(),
    );
  });
});
