import { Market, MARKET_STATE_LAYOUT_V3 } from "@project-serum/serum";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { Coin } from "./coin";

const REQUEST_QUEUE_SIZE = 5120 + 12; // https://github.com/mithraiclabs/psyoptions/blob/f0c9f73408a27676e0c7f156f5cae71f73f59c3f/programs/psy_american/src/lib.rs#L1003
const EVENT_QUEUE_SIZE = 262144 + 12; // https://github.com/mithraiclabs/psyoptions-ts/blob/ba1888ea83e634e1c7a8dad820fe67d053cf3f5c/packages/psy-american/src/instructions/initializeSerumMarket.ts#L84
const BIDS_SIZE = 65536 + 12; // Same reference as EVENT_QUEUE_SIZE
const ASKS_SIZE = 65536 + 12; // Same reference as EVENT_QUEUE_SIZE

export interface MarketAccounts {
  market: Keypair;
  requestQueue: Keypair;
  eventQueue: Keypair;
  bids: Keypair;
  asks: Keypair;
}

export class DexMarket {
  public address: PublicKey;

  public serumMarket: Market;

  public marketAccounts: MarketAccounts;

  public baseCoin: Coin;

  public quoteCoin: Coin;

  constructor(
    marketAccounts: MarketAccounts,
    serumMarket: Market,
    baseCoin: Coin,
    quoteCoin: Coin,
  ) {
    this.address = marketAccounts.market.publicKey;
    this.serumMarket = serumMarket;
    this.marketAccounts = marketAccounts;
    this.baseCoin = baseCoin;
    this.quoteCoin = quoteCoin;
  }

  static async createMarketAccounts(
    accounts: MarketAccounts,
    payer: Keypair,
    connection: Connection,
    dexProgram: PublicKey,
  ): Promise<void> {
    const { market, requestQueue, eventQueue, bids, asks } = accounts;

    const marketIx = SystemProgram.createAccount({
      newAccountPubkey: market.publicKey,
      fromPubkey: payer.publicKey,
      space: MARKET_STATE_LAYOUT_V3.span,
      lamports: await connection.getMinimumBalanceForRentExemption(
        MARKET_STATE_LAYOUT_V3.span,
      ),
      programId: dexProgram,
    });

    const requestQueueIx = SystemProgram.createAccount({
      newAccountPubkey: requestQueue.publicKey,
      fromPubkey: payer.publicKey,
      space: REQUEST_QUEUE_SIZE,
      lamports: await connection.getMinimumBalanceForRentExemption(
        REQUEST_QUEUE_SIZE,
      ),
      programId: dexProgram,
    });

    const eventQueueIx = SystemProgram.createAccount({
      newAccountPubkey: eventQueue.publicKey,
      fromPubkey: payer.publicKey,
      space: EVENT_QUEUE_SIZE,
      lamports: await connection.getMinimumBalanceForRentExemption(
        EVENT_QUEUE_SIZE,
      ),
      programId: dexProgram,
    });

    const bidsIx = SystemProgram.createAccount({
      newAccountPubkey: bids.publicKey,
      fromPubkey: payer.publicKey,
      space: BIDS_SIZE,
      lamports: await connection.getMinimumBalanceForRentExemption(BIDS_SIZE),
      programId: dexProgram,
    });

    const asksIx = SystemProgram.createAccount({
      newAccountPubkey: asks.publicKey,
      fromPubkey: payer.publicKey,
      space: ASKS_SIZE,
      lamports: await connection.getMinimumBalanceForRentExemption(ASKS_SIZE),
      programId: dexProgram,
    });

    const tx = new Transaction();
    tx.add(marketIx, requestQueueIx, eventQueueIx, bidsIx, asksIx);

    const txSig = await connection.sendTransaction(tx, [
      payer,
      market,
      requestQueue,
      eventQueue,
      bids,
      asks,
    ]);

    await connection.confirmTransaction(txSig, "confirmed");
  }
}
