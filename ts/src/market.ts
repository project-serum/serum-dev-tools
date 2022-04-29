import { DexInstructions, Market } from "@project-serum/serum";
import {
  OpenOrders,
  Order,
  OrderParams,
} from "@project-serum/serum/lib/market";
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
import { Market as SerumMarket } from "@project-serum/serum";
import { Coin } from "./coin";
import { getDecimalCount, withAssociatedTokenAccount } from "./utils";
import { TransactionWithSigners } from "./types";

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

  // public marketAccounts: MarketAccounts;

  public baseCoin: Coin;

  public quoteCoin: Coin;

  public marketSymbol: string;

  constructor(
    address: PublicKey,
    serumMarket: Market,
    baseCoin: Coin,
    quoteCoin: Coin,
  ) {
    this.address = address;
    this.serumMarket = serumMarket;
    this.baseCoin = baseCoin;
    this.quoteCoin = quoteCoin;
    this.marketSymbol = `${baseCoin.symbol}/${quoteCoin.symbol}`;
  }

  static async load(
    connection: Connection,
    programID: PublicKey,
    marketAddress: PublicKey,
    baseCoin: Coin,
    quoteCoin: Coin,
  ): Promise<DexMarket> {
    const serumMarket = await SerumMarket.load(
      connection,
      marketAddress,
      { commitment: "confirmed" },
      programID,
    );

    const dexMarket = new DexMarket(
      marketAddress,
      serumMarket,
      baseCoin,
      quoteCoin,
    );

    return dexMarket;
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

  static sanityCheck(serumMarket: SerumMarket, price: number, size: number) {
    const formattedMinOrderSize =
      serumMarket.minOrderSize?.toFixed(
        getDecimalCount(serumMarket.minOrderSize),
      ) || serumMarket.minOrderSize;

    const formattedTickSize =
      serumMarket.tickSize?.toFixed(getDecimalCount(serumMarket.tickSize)) ||
      serumMarket.tickSize;

    const isIncrement = (num, step) =>
      Math.abs((num / step) % 1) < 1e-5 ||
      Math.abs(((num / step) % 1) - 1) < 1e-5;

    if (isNaN(price)) throw new Error("Invalid Price");

    if (isNaN(size)) throw new Error("Invalid Size");

    if (!isIncrement(size, serumMarket.minOrderSize))
      throw new Error(`Size must be an increment of ${formattedMinOrderSize}`);

    if (size < serumMarket.minOrderSize)
      throw new Error(`Size must be greater than ${formattedMinOrderSize}`);

    if (!isIncrement(price, serumMarket.tickSize))
      throw new Error(
        `Price: ${price} must be an increment of ${formattedTickSize}`,
      );

    if (price < serumMarket.tickSize)
      throw new Error(`Price must be greater than ${formattedTickSize}`);
  }

  static async getPlaceOrderTransaction(
    connection: Connection,
    owner: Keypair,
    serumMarket: SerumMarket,
    side: "buy" | "sell",
    size: number,
    price: number,
  ): Promise<TransactionWithSigners> {
    try {
      DexMarket.sanityCheck(serumMarket, price, size);
    } catch (e) {
      console.log(e);
      throw new Error("Sanity check failed");
    }

    const openOrders = await DexMarket.getOrCreateOpenOrderAccount(
      owner,
      serumMarket,
      connection,
    );

    const transaction = new Transaction();
    const signers: Keypair[] = [];

    signers.push(owner);

    const baseCurrencyAccount = await withAssociatedTokenAccount(
      connection,
      serumMarket.baseMintAddress,
      owner,
      transaction,
    );
    const quoteCurrencyAccount = await withAssociatedTokenAccount(
      connection,
      serumMarket.quoteMintAddress,
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
      openOrdersAddressKey: openOrders.address,
    };

    const { transaction: placeOrderTx, signers: placeOrderSigners } =
      await serumMarket.makePlaceOrderTransaction(
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

    return { transaction, signers };
  }

  static async placeOrder(
    connection: Connection,
    owner: Keypair,
    serumMarket: SerumMarket,
    side: "buy" | "sell",
    size: number,
    price: number,
  ): Promise<string> {
    const { transaction, signers } = await DexMarket.getPlaceOrderTransaction(
      connection,
      owner,
      serumMarket,
      side,
      size,
      price,
    );

    const txSig = await connection.sendTransaction(transaction, signers);
    await connection.confirmTransaction(txSig, "confirmed");

    return txSig;
  }

  static async getCancelOrderTransaction(
    connection: Connection,
    owner: Keypair,
    serumMarket: SerumMarket,
    order: Order,
  ): Promise<TransactionWithSigners> {
    const transaction = await serumMarket.makeCancelOrderTransaction(
      connection,
      owner.publicKey,
      order,
    );

    return {
      transaction,
      signers: [owner],
    };
  }

  static async cancelOrder(
    connection: Connection,
    owner: Keypair,
    serumMarket: SerumMarket,
    order: Order,
  ): Promise<string> {
    const { transaction, signers } = await DexMarket.getCancelOrderTransaction(
      connection,
      owner,
      serumMarket,
      order,
    );

    const txSig = await connection.sendTransaction(transaction, signers);
    await connection.confirmTransaction(txSig, "confirmed");

    return txSig;
  }

  static async getOrCreateOpenOrderAccount(
    owner: Keypair,
    serumMarket: SerumMarket,
    connection: Connection,
  ): Promise<OpenOrders> {
    let openOrdersAccounts = await serumMarket.findOpenOrdersAccountsForOwner(
      connection,
      owner.publicKey,
      0,
    );

    if (openOrdersAccounts.length > 0) {
      return openOrdersAccounts[0];
    } else {
      const openOrderKP = Keypair.generate();

      const tx = new Transaction();
      tx.add(
        await OpenOrders.makeCreateAccountTransaction(
          connection,
          serumMarket.address,
          owner.publicKey,
          openOrderKP.publicKey,
          serumMarket.programId,
        ),
        await DexInstructions.initOpenOrders({
          market: serumMarket.publicKey,
          openOrders: openOrderKP.publicKey,
          owner: owner.publicKey,
          programId: serumMarket.programId,
          marketAuthority: null,
        }),
      );

      const txSig = await connection.sendTransaction(tx, [owner, openOrderKP]);
      console.log(txSig);
      await connection.confirmTransaction(txSig, "confirmed");

      openOrdersAccounts = await serumMarket.findOpenOrdersAccountsForOwner(
        connection,
        owner.publicKey,
        0,
      );

      if (openOrdersAccounts.length === 0) {
        throw new Error("Could not create open orders account");
      }

      return openOrdersAccounts[0];
    }
  }
}
