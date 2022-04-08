import {
  createMint,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import { Coin } from "./coin";
import BN from "bn.js";
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import { DexMarket, MarketAccounts } from "./market";
import { DexInstructions, Market as SerumMarket } from "@project-serum/serum";
import { getVaultOwnerAndNonce } from "./utils";

export type MarketArgs = {
  tickSize: number;
  lotSize: number;
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

  public async initDexMarket(
    baseCoin: Coin,
    quoteCoin: Coin,
    marketArgs: MarketArgs,
    payer: Keypair,
  ): Promise<DexMarket> {
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

    // https://github.com/solana-labs/solana-program-library/blob/master/token/js/src/actions/getOrCreateAssociatedTokenAccount.ts
    const baseVault = await getOrCreateAssociatedTokenAccount(
      this.connection,
      payer,
      baseCoin.mint,
      vaultOwner, // PDA derived from dex programID is vault owner
      true,
    );

    const quoteVault = await getOrCreateAssociatedTokenAccount(
      this.connection,
      payer,
      quoteCoin.mint,
      this.address, // PDA derived from dex programID is vault owner
      true,
    );

    const accountsIx = await DexMarket.createMarketAccountsInstructions(
      marketAccounts,
      payer,
      this.connection,
      this.address,
    );

    let baseLotSize;
    let quoteLotSize;
    if (marketArgs.lotSize > 0) {
      baseLotSize = Math.round(10 ** baseCoin.decimals * marketArgs.lotSize);
      quoteLotSize = Math.round(
        marketArgs.lotSize * 10 ** quoteCoin.decimals * marketArgs.tickSize,
      );
    }

    const initSerumMarketIx = await DexInstructions.initializeMarket({
      market: marketAccounts.market.publicKey,
      requestQueue: marketAccounts.requestQueue.publicKey,
      eventQueue: marketAccounts.eventQueue.publicKey,
      bids: marketAccounts.bids.publicKey,
      asks: marketAccounts.asks.publicKey,
      baseVault: baseVault.address,
      quoteVault: quoteVault.address,
      baseMint: baseCoin.mint,
      quoteMint: quoteCoin.mint,
      baseLotSize: new BN(baseLotSize),
      quoteLotSize: new BN(quoteLotSize),
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

    const serumMarket = await SerumMarket.load(
      this.connection,
      marketAccounts.market.publicKey,
      { commitment: "confirmed" },
      this.address,
    );

    return new DexMarket(marketAccounts, serumMarket, baseCoin, quoteCoin);
  }
}
