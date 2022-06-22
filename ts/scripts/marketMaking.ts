import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { Dex, FileKeypair } from "../src";

process.on("beforeExit", () => console.log("Parent process exiting..."));

const main = async () => {
  console.log("Process: ", process.pid);
  const connection = new Connection("http://localhost:8899", "confirmed");

  const owner = FileKeypair.generate("./scripts/keys/owner.json");
  console.log("Owner: ", owner.keypair.publicKey.toString());

  const airdropSig = await connection.requestAirdrop(
    owner.keypair.publicKey,
    10 * LAMPORTS_PER_SOL,
  );
  await connection.confirmTransaction(airdropSig);

  const dexAddress = new PublicKey(
    "7zo7HCQAZPRb4pYiQQ6fLjC8ssN3E8LkavVs8JUA5NMn",
  );
  const dex = new Dex(dexAddress, connection);

  const baseCoin = await dex.createCoin(
    "SAYA",
    9,
    owner.keypair,
    owner.keypair,
    owner.keypair,
  );
  const quoteCoin = await dex.createCoin(
    "SRM",
    9,
    owner.keypair,
    owner.keypair,
    owner.keypair,
  );

  const market = await dex.initDexMarket(owner.keypair, baseCoin, quoteCoin, {
    lotSize: 1e-3,
    tickSize: 1e-2,
  });

  console.log(
    `Created ${market.marketSymbol} market @ ${market.address.toString()}`,
  );

  await baseCoin.fundAccount(1000000, owner.keypair, connection);
  await quoteCoin.fundAccount(2000000, owner.keypair, connection);

  console.log(`Funded owner with ${baseCoin.symbol} and ${quoteCoin.symbol}`);

  dex.runMarketMaker(market, owner, {
    durationInSecs: 30,
    orderCount: 3,
    initialBidSize: 1000,
    baseGeckoSymbol: "solana",
    quoteGeckoSymbol: "usd",
  });

  dex.runCrank(market, owner, {
    durationInSecs: 20,
    verbose: true,
  });
};

const runMain = async () => {
  try {
    await main();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

runMain();
