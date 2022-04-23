import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import BN from "bn.js";
import { Dex } from "../src";

const main = async () => {
  const connection = new Connection("http://localhost:8899", "confirmed");

  const owner = Keypair.generate();

  const airdropSig = await connection.requestAirdrop(
    owner.publicKey,
    5 * LAMPORTS_PER_SOL,
  );
  await connection.confirmTransaction(airdropSig);

  const dexAddress = new PublicKey(
    "7zo7HCQAZPRb4pYiQQ6fLjC8ssN3E8LkavVs8JUA5NMn",
  );
  const dex = new Dex(dexAddress, connection);

  const baseCoin = await dex.createCoin("SAYA", 0, owner, owner, owner);
  const quoteCoin = await dex.createCoin("SRM", 6, owner, owner, owner);

  const market = await dex.initDexMarket(owner, baseCoin, quoteCoin, {
    tickSize: 0.01,
    baseLotSize: new BN(1),
    quoteLotSize: new BN(1e4),
    feeRate: 10,
    quoteDustThreshold: new BN(100),
  });

  console.log(`Created ${market.marketSymbol} market.`);

  await baseCoin.fundAccount(10000, owner, connection);
  await quoteCoin.fundAccount(20000, owner, connection);

  await market.placeOrder(connection, owner, "buy", 1, 10);
};

const runMain = async () => {
  try {
    await main();
    process.exit(0);
  } catch (e) {
    console.log(e);
    process.exit(1);
  }
};

runMain();
