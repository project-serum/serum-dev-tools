import { Signer, Transaction } from "@solana/web3.js";

export type TransactionWithSigners = {
  transaction: Transaction;
  signers: Signer[];
};

export type OrderType = "limit" | "ioc" | "postOnly";
