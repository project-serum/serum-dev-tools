import { Market } from "@project-serum/serum";
import { OrderParams } from "@project-serum/serum/lib/market";
import {
  createInitializeAccountInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { Coin } from "./coin";
import { getDecimalCount, withAssociatedTokenAccount } from "./utils";

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

  public marketSymbol: string;

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
    this.marketSymbol = `${baseCoin.symbol}/${quoteCoin.symbol}`;
  }

  static async createMarketVaultsTransaction(
    payer: Keypair,
    vaultOwner: PublicKey,
    baseVault: Keypair,
    quoteVault: Keypair,
    baseCoin: Coin,
    quoteCoin: Coin,
    connection: Connection,
  ): Promise<Transaction> {
    const tx = new Transaction();

    tx.add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: baseVault.publicKey,
        lamports: await connection.getMinimumBalanceForRentExemption(165),
        space: 165,
        programId: TOKEN_PROGRAM_ID,
      }),
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: quoteVault.publicKey,
        lamports: await connection.getMinimumBalanceForRentExemption(165),
        space: 165,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeAccountInstruction(
        baseVault.publicKey,
        baseCoin.mint,
        vaultOwner,
        TOKEN_PROGRAM_ID,
      ),
      createInitializeAccountInstruction(
        quoteVault.publicKey,
        quoteCoin.mint,
        vaultOwner,
        TOKEN_PROGRAM_ID,
      ),
    );

    return tx;
  }

  static async createMarketAccountsInstructions(
    accounts: MarketAccounts,
    payer: Keypair,
    connection: Connection,
    dexProgram: PublicKey,
  ): Promise<TransactionInstruction[]> {
    const { market, requestQueue, eventQueue, bids, asks } = accounts;

    const marketIx = SystemProgram.createAccount({
      newAccountPubkey: market.publicKey,
      fromPubkey: payer.publicKey,
      space: Market.getLayout(dexProgram).span,
      lamports: await connection.getMinimumBalanceForRentExemption(
        Market.getLayout(dexProgram).span,
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

    return [marketIx, requestQueueIx, eventQueueIx, bidsIx, asksIx];
  }

  private sanityCheck(price: number, size: number) {
    const formattedMinOrderSize =
      this.serumMarket.minOrderSize?.toFixed(
        getDecimalCount(this.serumMarket.minOrderSize),
      ) || this.serumMarket.minOrderSize;

    const formattedTickSize =
      this.serumMarket.tickSize?.toFixed(
        getDecimalCount(this.serumMarket.tickSize),
      ) || this.serumMarket.tickSize;

    const isIncrement = (num, step) =>
      Math.abs((num / step) % 1) < 1e-5 ||
      Math.abs(((num / step) % 1) - 1) < 1e-5;

    if (isNaN(price)) throw new Error("Invalid Price");

    if (isNaN(size)) throw new Error("Invalid Size");

    if (!isIncrement(size, this.serumMarket.minOrderSize))
      throw new Error(`Size must be an increment of ${formattedMinOrderSize}`);

    if (size < this.serumMarket.minOrderSize)
      throw new Error(`Size must be greater than ${formattedMinOrderSize}`);

    if (!isIncrement(price, this.serumMarket.tickSize))
      throw new Error(
        `Price: ${price} must be an increment of ${formattedTickSize}`,
      );

    if (price < this.serumMarket.tickSize)
      throw new Error(`Price must be greater than ${formattedTickSize}`);
  }

  public async placeOrder(
    connection: Connection,
    owner: Keypair,
    side: "buy" | "sell",
    size: number,
    price: number,
  ) {
    try {
      this.sanityCheck(price, size);
    } catch (e) {
      console.log(e);
      throw new Error("Sanity check failed");
    }

    const transaction = new Transaction();
    const signers: Keypair[] = [];

    signers.push(owner);

    const baseCurrencyAccount = await withAssociatedTokenAccount(
      connection,
      this.baseCoin.mint,
      owner,
      transaction,
    );
    const quoteCurrencyAccount = await withAssociatedTokenAccount(
      connection,
      this.quoteCoin.mint,
      owner,
      transaction,
    );

    const payer = side === "sell" ? baseCurrencyAccount : quoteCurrencyAccount;
    if (!payer) {
      throw new Error("Need an SPL token account for cost currency as payer");
    }

    const params: OrderParams<PublicKey> = {
      owner: owner.publicKey,
      payer,
      side,
      price,
      size,
      orderType: "limit",
      feeDiscountPubkey: null,
    };

    const { transaction: placeOrderTx, signers: placeOrderSigners } =
      await this.serumMarket.makePlaceOrderTransaction(
        connection,
        params,
        120_000,
        120_000,
      );

    transaction.add(placeOrderTx);
    signers.push(
      ...placeOrderSigners.map((signer) =>
        Keypair.fromSecretKey(signer.secretKey),
      ),
    );

    const txSig = await connection.sendTransaction(transaction, signers);
    await connection.confirmTransaction(txSig, "confirmed");

    console.log(`Order placed: ${txSig}`);
  }
}
