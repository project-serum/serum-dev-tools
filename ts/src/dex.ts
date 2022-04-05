import { createMint } from "@solana/spl-token";
import { Coin } from "./coin";
import {
  EVENT_QUEUE_LAYOUT,
  MARKET_STATE_LAYOUT_V3,
  REQUEST_QUEUE_LAYOUT,
} from "@project-serum/serum";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

interface DexAccounts {
  market: Keypair;
  requestQueue: Keypair;
  eventQueue: Keypair;
  bids: Keypair;
  asks: Keypair;
}
export class Dex {
  public address: PublicKey;

  coins: Coin[];

  connection: Connection;

  constructor(address: PublicKey, connection: Connection) {
    this.address = address;
    this.connection = connection;
    this.coins = [];
  }

  public createCoin = async (
    symbol: string,
    decimals: number,
    payer: Keypair,
    mintAuthority: PublicKey | null,
    freezeAuthority: PublicKey | null,
  ): Promise<PublicKey> => {
    const mint = await createMint(
      this.connection,
      payer,
      mintAuthority,
      freezeAuthority,
      decimals,
    );
    this.coins.push({
      symbol,
      decimals,
      mint,
    });

    return mint;
  };

  public getCoin(symbol: string): Coin | null {
    const coin = this.coins.find((coin) => coin.symbol === symbol);

    return coin ? coin : null;
  }

  static async createAccounts(
    accounts: DexAccounts,
    payer: Keypair,
    connection: Connection,
    dexProgram: PublicKey,
  ): Promise<string> {
    const { market, requestQueue, eventQueue } = accounts;

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
      space:
        REQUEST_QUEUE_LAYOUT.HEADER.span +
        20 * REQUEST_QUEUE_LAYOUT.NODE.span +
        7, // + 7 for the tail padding
      lamports: await connection.getMinimumBalanceForRentExemption(
        REQUEST_QUEUE_LAYOUT.HEADER.span +
          20 * REQUEST_QUEUE_LAYOUT.NODE.span +
          7,
      ),
      programId: dexProgram,
    });

    const eventQueueIx = SystemProgram.createAccount({
      newAccountPubkey: eventQueue.publicKey,
      fromPubkey: payer.publicKey,
      space:
        EVENT_QUEUE_LAYOUT.HEADER.span + 20 * EVENT_QUEUE_LAYOUT.NODE.span + 7, // + 7 for the tail padding
      lamports: await connection.getMinimumBalanceForRentExemption(
        EVENT_QUEUE_LAYOUT.HEADER.span + 20 * EVENT_QUEUE_LAYOUT.NODE.span + 7,
      ),
      programId: dexProgram,
    });

    // const bidsIx = SystemProgram.createAccount({
    //   newAccountPubkey: bids.publicKey,
    //   fromPubkey: payer.publicKey,
    //   space: ORDERBOOK_LAYOUT.span,
    //   lamports: await connection.getMinimumBalanceForRentExemption(
    //     ORDERBOOK_LAYOUT.span, // returns -1,
    //   ),
    //   programId: dexProgram,
    // });

    // const asksIx = SystemProgram.createAccount({
    //   newAccountPubkey: asks.publicKey,
    //   fromPubkey: payer.publicKey,
    //   space: ORDERBOOK_LAYOUT.span,
    //   lamports: await connection.getMinimumBalanceForRentExemption(
    //     ORDERBOOK_LAYOUT.span, // returns -1
    //   ),
    //   programId: dexProgram,
    // });

    const tx = new Transaction();
    tx.add(marketIx, requestQueueIx, eventQueueIx);

    const txSig = await connection.sendTransaction(tx, [
      payer,
      market,
      requestQueue,
      eventQueue,
    ]);

    return txSig;
  }
}
