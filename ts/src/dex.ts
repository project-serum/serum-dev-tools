import {
  createMint,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import { Coin } from "./coin";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { DexMarket, MarketAccounts } from "./market";
import { DexInstructions, Market as SerumMarket } from "@project-serum/serum";

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

  public async initDexMarket(
    baseCoin: Coin,
    quoteCoin: Coin,
    marketOptions: {
      baseLotSize: number;
      quoteLotSize: number;
      feeRate: number;
      quoteDustThreshold: number;
    },
    payer: Keypair,
  ): Promise<DexMarket> {
    const marketAccounts: MarketAccounts = {
      market: Keypair.generate(),
      requestQueue: Keypair.generate(),
      eventQueue: Keypair.generate(),
      bids: Keypair.generate(),
      asks: Keypair.generate(),
    };

    await DexMarket.createMarketAccounts(
      marketAccounts,
      payer,
      this.connection,
      this.address,
    );

    const [vaultOwner, vaultOwnerNonce] = await PublicKey.findProgramAddress(
      [this.address.toBuffer()],
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
      baseLotSize: marketOptions.baseLotSize,
      quoteLotSize: marketOptions.quoteLotSize,
      feeRateBps: marketOptions.feeRate,
      quoteDustThreshold: marketOptions.quoteDustThreshold,
      vaultSignerNonce: vaultOwnerNonce,
      programId: this.address,
    });

    const tx = new Transaction().add(initSerumMarketIx);

    const txSig = await this.connection.sendTransaction(tx, []);

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
