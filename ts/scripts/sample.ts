import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { Dex, FileKeypair } from "../src";

const main = async () => {
  const connection = new Connection("http://localhost:8899", "confirmed");

  const owner = FileKeypair.generate("./scripts/keys/owner.json");

  const airdropSig = await connection.requestAirdrop(
    owner.keypair.publicKey,
    5 * LAMPORTS_PER_SOL,
  );
  await connection.confirmTransaction(airdropSig);

  const dexAddress = new PublicKey(
    "7zo7HCQAZPRb4pYiQQ6fLjC8ssN3E8LkavVs8JUA5NMn",
  );
  const dex = new Dex(dexAddress, connection);

  const baseCoin = await dex.createCoin(
    "SAYA",
    0,
    owner.keypair,
    owner.keypair,
    owner.keypair,
  );
  const quoteCoin = await dex.createCoin(
    "SRM",
    6,
    owner.keypair,
    owner.keypair,
    owner.keypair,
  );

  const market = await dex.initDexMarket(owner.keypair, baseCoin, quoteCoin, {
    tickSize: 0.01,
    baseLotSize: new BN(1),
    quoteLotSize: new BN(1e4),
    feeRate: 10,
    quoteDustThreshold: new BN(100),
  });

  console.log(`Created ${market.marketSymbol} market.`);

  await baseCoin.fundAccount(10000, owner.keypair, connection);
  await quoteCoin.fundAccount(20000, owner.keypair, connection);

  console.log(`Funded owner with ${baseCoin.symbol} and ${quoteCoin.symbol}`);

  dex.runMarketMaker(market, owner);
};

main();
