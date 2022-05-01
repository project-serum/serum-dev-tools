import {
  Connection,
  Keypair,
  PublicKey,
  Signer,
  Transaction,
} from "@solana/web3.js";
import { Market as SerumMarket } from "@project-serum/serum";
import { FileKeypair } from "../fileKeypair";
import { DexMarket } from "../market";

type MessageType = {
  action: "start";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any;
};

process.on("message", async (message: MessageType) => {
  if (message.action === "start") {
    await marketMaker(message.args);
  }
});

const cancelOrders = async (
  owner: Keypair,
  serumMarket: SerumMarket,
  connection: Connection,
) => {
  const orders = await serumMarket.loadOrdersForOwner(
    connection,
    owner.publicKey,
  );

  const tx = new Transaction();
  const signersArray: Signer[][] = [];

  for (const order of orders) {
    const { transaction, signers } = await DexMarket.getCancelOrderTransaction(
      connection,
      owner,
      serumMarket,
      order,
    );
    tx.add(transaction);
    signersArray.push(signers);
  }

  const signersUnion: Signer[] = [...new Set(signersArray.flat())];

  const txSig = await connection.sendTransaction(tx, signersUnion);

  await connection.confirmTransaction(txSig, "confirmed");

  console.log(`----- Cancelled ${orders.length} orders ------`);
};

const placeOrders = async (
  owner: Keypair,
  serumMarket: SerumMarket,
  connection: Connection,
  opts: {
    isBuy: boolean;
    midPrice: number;
    count: number;
  },
) => {
  const { isBuy, midPrice, count } = opts;

  const tx = new Transaction();
  const signersArray: Signer[][] = [];

  for (let i = 0; i < count; i++) {
    const orderPrice =
      midPrice +
      (isBuy ? -1 * (midPrice * 0.01 * (i + 1)) : midPrice * 0.01) * (i + 1);

    const { transaction, signers } = await DexMarket.getPlaceOrderTransaction(
      connection,
      owner,
      serumMarket,
      isBuy ? "buy" : "sell",
      10,
      orderPrice,
    );
    tx.add(transaction);
    signersArray.push(signers);

    console.log(`Order ${i} price: ${orderPrice}`);
  }

  const signersUnion: Signer[] = [...new Set(signersArray.flat())];

  const txSig = await connection.sendTransaction(tx, signersUnion);

  await connection.confirmTransaction(txSig, "confirmed");

  console.log(
    `----- Placed ${count} ${
      isBuy ? "buy" : "sell"
    } orders at midPrice: ${midPrice} ------c`,
  );
};

const marketMaker = async (args) => {
  const connection = new Connection(args.rpcEndpoint, "confirmed");

  const serumMarket = await SerumMarket.load(
    connection,
    new PublicKey(args.marketAddress),
    { commitment: "confirmed" },
    new PublicKey(args.programID),
  );

  const owner = FileKeypair.load(args.ownerFilePath);

  placeOrders(owner.keypair, serumMarket, connection, {
    isBuy: true,
    midPrice: 10,
    count: 3,
  });

  setInterval(async () => {
    await cancelOrders(owner.keypair, serumMarket, connection);
    await placeOrders(owner.keypair, serumMarket, connection, {
      isBuy: true,
      midPrice: 10,
      count: 3,
    });
  }, 10000);

  if (Number.parseInt(args.duration) > 0) {
    setTimeout(() => {
      console.log(`Exiting Market Maker @ ${process.pid}`);
      process.exit(0);
    }, Number.parseInt(args.duration));
  }
};
