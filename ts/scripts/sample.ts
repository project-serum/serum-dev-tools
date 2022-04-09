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

  const baseCoin = await dex.createCoin(
    "SAYA",
    9,
    owner,
    owner.publicKey,
    owner.publicKey,
  );
  const quoteCoin = await dex.createCoin(
    "SRM",
    9,
    owner,
    owner.publicKey,
    owner.publicKey,
  );

  const market = await dex.initDexMarket(owner, baseCoin, quoteCoin, {
    tickSize: 0.001,
    lotSize: 10,
    feeRate: 10,
    quoteDustThreshold: new BN(100),
  });

  console.log(`Created ${market.marketSymbol} market.`);
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
