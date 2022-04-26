import { createMint } from "@solana/spl-token";
import BN from "bn.js";
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import { DexMarket, MarketAccounts } from "./market";
import { DexInstructions } from "@project-serum/serum";
import { getVaultOwnerAndNonce } from "./utils";
import { Coin } from "./coin";
import { fork } from "child_process";
import { FileKeypair } from "./fileKeypair";

export type MarketArgs = {
  tickSize: number;
  baseLotSize: BN;
  quoteLotSize: BN;
  feeRate: number;
  quoteDustThreshold: BN;
};
export class Dex {
  public address: PublicKey;

  coins: Coin[];

  markets: DexMarket[];

  connection: Connection;

  constructor(address: PublicKey, connection: Connection) {
    this.address = address;
    this.connection = connection;
    this.coins = [];
    this.markets = [];
  }

  public createCoin = async (
    symbol: string,
    decimals: number,
    payer: Keypair,
    mintAuthority: Keypair | null,
    freezeAuthority: Keypair | null,
  ): Promise<Coin> => {
    const mint = await createMint(
      this.connection,
      payer,
      mintAuthority ? mintAuthority.publicKey : null,
      freezeAuthority ? freezeAuthority.publicKey : null,
      decimals,
    );

    const coin = new Coin(
      symbol,
      decimals,
      mint,
      mintAuthority,
      freezeAuthority,
    );

    this.coins.push(coin);

    return coin;
  };

  public getCoin(symbol: string): Coin | null {
    const coin = this.coins.find((coin) => coin.symbol === symbol);

    return coin ? coin : null;
  }

  public getMarket(baseCoin: Coin, quoteCoin: Coin): DexMarket | null {
    const dexMarket = this.markets.find(
      (market) =>
        market.baseCoin === baseCoin && market.quoteCoin === quoteCoin,
    );

    return dexMarket ? dexMarket : null;
  }

  public async initDexMarket(
    payer: Keypair,
    baseCoin: Coin,
    quoteCoin: Coin,
    marketArgs: MarketArgs,
  ): Promise<DexMarket> {
    if (this.getMarket(baseCoin, quoteCoin) != null) {
      throw new Error("Market already exists");
    }

    const marketAccounts: MarketAccounts = {
      market: Keypair.generate(),
      requestQueue: Keypair.generate(),
      eventQueue: Keypair.generate(),
      bids: Keypair.generate(),
      asks: Keypair.generate(),
    };

    const [vaultOwner, vaultOwnerNonce] = await getVaultOwnerAndNonce(
      marketAccounts.market.publicKey,
      this.address,
    );

    const baseVault = Keypair.generate();
    const quoteVault = Keypair.generate();

    const vaultTx = await DexMarket.createMarketVaultsTransaction(
      payer,
      vaultOwner,
      baseVault,
      quoteVault,
      baseCoin,
      quoteCoin,
      this.connection,
    );
    const vaultSig = await this.connection.sendTransaction(vaultTx, [
      payer,
      baseVault,
      quoteVault,
    ]);
    await this.connection.confirmTransaction(vaultSig);

    // let baseLotSize;
    // let quoteLotSize;
    // if (marketArgs.lotSize > 0) {
    //   baseLotSize = Math.round(10 ** baseCoin.decimals * marketArgs.lotSize);
    //   quoteLotSize = Math.round(
    //     10 ** quoteCoin.decimals * marketArgs.lotSize * marketArgs.tickSize,
    //   );
    // } else {
    //   throw new Error("Invalid Lot Size");
    // }

    const accountsIx = await DexMarket.createMarketAccountsInstructions(
      marketAccounts,
      payer,
      this.connection,
      this.address,
    );

    const initSerumMarketIx = await DexInstructions.initializeMarket({
      market: marketAccounts.market.publicKey,
      requestQueue: marketAccounts.requestQueue.publicKey,
      eventQueue: marketAccounts.eventQueue.publicKey,
      bids: marketAccounts.bids.publicKey,
      asks: marketAccounts.asks.publicKey,
      baseVault: baseVault.publicKey,
      quoteVault: quoteVault.publicKey,
      baseMint: baseCoin.mint,
      quoteMint: quoteCoin.mint,
      baseLotSize: marketArgs.baseLotSize,
      quoteLotSize: marketArgs.quoteLotSize,
      feeRateBps: marketArgs.feeRate,
      quoteDustThreshold: marketArgs.quoteDustThreshold,
      vaultSignerNonce: vaultOwnerNonce,
      programId: this.address,
    });

    const tx = new Transaction().add(...accountsIx, initSerumMarketIx);

    const txSig = await sendAndConfirmTransaction(this.connection, tx, [
      payer,
      marketAccounts.market,
      marketAccounts.requestQueue,
      marketAccounts.eventQueue,
      marketAccounts.bids,
      marketAccounts.asks,
    ]);

    await this.connection.confirmTransaction(txSig, "confirmed");

    const dexMarket = await DexMarket.load(
      this.connection,
      this.address,
      marketAccounts.market.publicKey,
      baseCoin,
      quoteCoin,
    );

    this.markets.push(dexMarket);

    return dexMarket;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async runMarketMaker(market: DexMarket, owner: FileKeypair) {
    const child = fork("./src/scripts/marketMaker", null, {
      detached: true,
      stdio: ["pipe", 0, 0, "ipc"],
      env: {
        size: "1",
        price: "10",
      },
    });

    // https://nodejs.org/api/child_process.html#optionsdetached
    child.unref();

    child.send({
      action: "start",
      args: {
        marketAddress: market.address.toString(),
        programID: this.address.toString(),
        rpcEndpoint: this.connection.rpcEndpoint,
        ownerFilePath: owner.filePath,
      },
    });

    console.log(`Market Maker started at process ${child.pid}`);
  }
}
