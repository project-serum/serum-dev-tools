import {
  getMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  RpcResponseAndContext,
  TokenAmount,
} from "@solana/web3.js";

export class Coin {
  symbol: string;

  decimals: number;

  mint: PublicKey;

  mintAuthority: Keypair;

  freezeAuthority: Keypair | null;

  constructor(
    symbol: string,
    decimals: number,
    mint: PublicKey,
    mintAuthority: Keypair,
    freezeAuthority: Keypair | null,
  ) {
    this.symbol = symbol;
    this.decimals = decimals;
    this.mint = mint;
    this.mintAuthority = mintAuthority;
    this.freezeAuthority = freezeAuthority;
  }

  static async load(
    connection: Connection,
    symbol: string,
    mint: PublicKey,
    mintAuthority: Keypair,
    freezeAuthority: Keypair | null,
  ): Promise<Coin> {
    const {
      decimals,
      mintAuthority: tokenMintAuthority,
      freezeAuthority: tokenFreezeAuthority,
    } = await getMint(connection, mint, "confirmed");

    // tokenMintAuthority has to be truthy since createMint requires a mint authority as well.
    if (
      !tokenMintAuthority ||
      tokenMintAuthority.toBase58() !== mintAuthority.publicKey.toBase58()
    ) {
      throw new Error("Invalid Mint authority provided");
    }

    if (!!tokenFreezeAuthority !== !!freezeAuthority) {
      throw new Error("Invalid Freeze authority provided");
    }

    if (
      tokenFreezeAuthority &&
      freezeAuthority &&
      tokenFreezeAuthority.toBase58() !== freezeAuthority.publicKey.toBase58()
    ) {
      throw new Error("Invalid Freeze authority provided");
    }

    return new Coin(symbol, decimals, mint, mintAuthority, freezeAuthority);
  }

  /**
   * Get the token balance for the specified owner.
   *
   * @param owner The `Keypair` whose balance to fetch.
   * @param connection The `Connection` object to connect to Solana.
   * @returns
   */
  public async getBalance(
    owner: Keypair,
    connection: Connection,
  ): Promise<RpcResponseAndContext<TokenAmount>> {
    const ata = await getOrCreateAssociatedTokenAccount(
      connection,
      owner,
      this.mint,
      owner.publicKey,
      true,
      "confirmed",
    );

    const tokenAmount = await connection.getTokenAccountBalance(
      ata.address,
      "confirmed",
    );

    return tokenAmount;
  }

  /**
   * Fund the owner key-pair with the specified amount of this coin.
   *
   * @param decimalAmount The amount of tokens to fund account with, in decimal notation.
   * @param owner The `Keypair` to fund.
   * @param connection The `Connection` object to connect to Solana.
   */
  public async fundAccount(
    decimalAmount: number,
    owner: Keypair,
    connection: Connection,
  ): Promise<void> {
    if (!this.mintAuthority) {
      throw new Error("Coin has no mint authority");
    }

    const destination = await getOrCreateAssociatedTokenAccount(
      connection,
      owner,
      this.mint,
      owner.publicKey,
      true,
      "confirmed",
    );

    const atomicAmount = BigInt(decimalAmount * 10 ** this.decimals);

    const txSig = await mintTo(
      connection,
      owner,
      this.mint,
      destination.address,
      this.mintAuthority,
      atomicAmount,
    );

    await connection.confirmTransaction(txSig);
  }
}
