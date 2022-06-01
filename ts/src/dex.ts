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
import { ChildProcess, fork } from "child_process";
import { FileKeypair } from "./fileKeypair";

/**
 * @param lotSize This is the smallest representable amount of the base coin .
 * @param tickSize  This is the smallest representable amount of the quote coin.
 * @param feeRate
 * @param quoteDustThreshold
 */
export type MarketParams = {
  lotSize: number;
  tickSize: number;
  feeRate: number;
  quoteDustThreshold: BN;
};

/**
 * @param durationInSecs
 * @param orderCount
 * @param initialBidSize
 * @param baseGeckoSymbol
 * @param quoteGeckoSymbol
 */
type MarketMakerOpts = {
  // unref: boolean;
  durationInSecs: number;
  orderCount: number;
  initialBidSize: number;
  baseGeckoSymbol: string;
  quoteGeckoSymbol: string;
};

/**
 * Dex is a wrapper class for a deployed Serum Dex program.
 */
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

  /**
   * Create a `Coin` object to be associated with the `Dex`.
   *
   * @param symbol The symbol of the coin to create
   * @param decimals The decimals of the coin to create
   * @param payer The payer `Keypair` to use for the transactions
   * @param mintAuthority The mint authority `Keypair` to use for the mint
   * @param freezeAuthority The freeze authority `Keypair` to use for the mint
   * @returns
   */
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

  /**
   * Fetch one of the `Coin` objects associated with the `Dex` by symbol.
   *
   * @param symbol The symbol of the coin to fetch
   * @returns
   */
  public getCoin(symbol: string): Coin | null {
    const coin = this.coins.find((coin) => coin.symbol === symbol);

    return coin ? coin : null;
  }

  /**
   * Fetch a `DexMarket` object associated with the `Dex` by the base coin and quote coin.
   *
   * @param baseCoin The base `Coin` of the market to fetch
   * @param quoteCoin The quote `Coin` of the market to fetch
   * @returns
   */
  public getMarket(baseCoin: Coin, quoteCoin: Coin): DexMarket | null {
    const dexMarket = this.markets.find(
      (market) =>
        market.baseCoin === baseCoin && market.quoteCoin === quoteCoin,
    );

    return dexMarket ? dexMarket : null;
  }

  /**
   * Initialize a `DexMarket` instance associated with the `Dex`.
   *
   * @param payer The payer `Keypair` to use for the transactions
   * @param baseCoin The base `Coin` of the market to create
   * @param quoteCoin The quote `Coin` of the market to create
   * @param marketParams The parameters required to create the market
   * @returns
   */
  public async initDexMarket(
    payer: Keypair,
    baseCoin: Coin,
    quoteCoin: Coin,
    marketParams: MarketParams,
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

    let baseLotSize;
    let quoteLotSize;
    if (marketParams.lotSize > 0) {
      baseLotSize = Math.round(10 ** baseCoin.decimals * marketParams.lotSize);
      quoteLotSize = Math.round(
        10 ** quoteCoin.decimals * marketParams.lotSize * marketParams.tickSize,
      );
    } else {
      throw new Error("Invalid Lot Size");
    }

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
      baseLotSize: new BN(baseLotSize),
      quoteLotSize: new BN(quoteLotSize),
      feeRateBps: marketParams.feeRate,
      quoteDustThreshold: marketParams.quoteDustThreshold,
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

  /**
   * Runs a Market Making on a separate node process for `durationInSecs` seconds.
   *
   * @param market The `DexMarket` to run market maker on
   * @param owner The owner `Keypair` to use for the market making.
   * @param opts The market making options used.
   * @returns
   */
  public runMarketMaker(
    market: DexMarket,
    owner: FileKeypair,
    opts: MarketMakerOpts,
  ): ChildProcess {
    if (opts.durationInSecs < 0)
      throw new Error("Duration must be greater than 0.");

    const child = fork(`${__dirname}/scripts/marketMaker`, null, {
      // https://nodejs.org/api/child_process.html#optionsdetached
      // detached also doesn't seem to be making a difference.
      detached: true,
      stdio: ["pipe", 0, 0, "ipc"],
    });

    console.log(
      `Process ${child.pid}: Running Market Maker for ${market.baseCoin.symbol}/${market.quoteCoin.symbol}. Note: No crank running`,
    );

    // unref doesn't seem to be making a difference for a forked process.
    // but process is detached so parent can exit manually

    // https://nodejs.org/api/child_process.html#subprocessunref
    // if (opts.unref) child.unref;

    child.send({
      action: "start",
      args: {
        marketAddress: market.address.toString(),
        programID: this.address.toString(),
        rpcEndpoint: this.connection.rpcEndpoint,
        ownerFilePath: owner.filePath,
        duration: opts.durationInSecs * 1000,
        orderCount: opts.orderCount,
        initialBidSize: opts.initialBidSize,
        baseGeckoSymbol: opts.baseGeckoSymbol,
        quoteGeckoSymbol: opts.quoteGeckoSymbol,
      },
    });

    return child;
  }
}
