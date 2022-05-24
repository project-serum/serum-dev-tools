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
import axios from "axios";
import { getDecimalCount, roundToDecimal } from "../utils";

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

const getMidPrice = async (
  baseSymbol: string,
  quoteSymbol: string,
): Promise<number> => {
  const API_URL = `https://api.coingecko.com/api/v3/simple/price?ids=${baseSymbol}&vs_currencies=${quoteSymbol}`;
  const response = await axios.get(API_URL);
  return response.data[baseSymbol][quoteSymbol];
};

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

  console.log(`----- ${orders.length} CancelOrders Confirmed -----`);
};

const placeOrders = async (
  owner: Keypair,
  serumMarket: SerumMarket,
  connection: Connection,
  opts: {
    orderCount: number;
    initialBidSize: number;
    baseGeckoSymbol: string;
    quoteGeckoSymbol: string;
  },
) => {
  let midPrice: number;
  try {
    midPrice = await getMidPrice(opts.baseGeckoSymbol, opts.quoteGeckoSymbol);
  } catch (e) {
    console.error("Couldn't fetch price from CoinGecko.");
    process.exit(1);
  }

  console.log("Mid price:", midPrice);

  const { orderCount, initialBidSize } = opts;

  const tx = new Transaction();
  const signersArray: Signer[][] = [];

  let bidSizeMultiplier = 1;

  for (let i = 0; i < orderCount; i++, bidSizeMultiplier++) {
    const buyPrice = roundToDecimal(
      midPrice * (1 - 0.01 * (i + 1)),
      getDecimalCount(serumMarket.tickSize),
    );
    const sellPrice = roundToDecimal(
      midPrice * (1 + 0.01 * (i + 1)),
      getDecimalCount(serumMarket.tickSize),
    );

    const buySize = roundToDecimal(
      initialBidSize * bidSizeMultiplier,
      getDecimalCount(serumMarket.minOrderSize),
    );
    const sellSize = roundToDecimal(
      (initialBidSize * bidSizeMultiplier) / midPrice,
      getDecimalCount(serumMarket.minOrderSize),
    );

    const { transaction: buyTransaction, signers: buySigners } =
      await DexMarket.getPlaceOrderTransaction(
        connection,
        owner,
        serumMarket,
        "buy",
        "postOnly",
        buySize,
        buyPrice,
      );
    tx.add(buyTransaction);
    signersArray.push(buySigners);

    console.log(`Bid placed with price ${buyPrice} and size ${buySize}`);

    const { transaction: sellTransaction, signers: sellSigners } =
      await DexMarket.getPlaceOrderTransaction(
        connection,
        owner,
        serumMarket,
        "sell",
        "postOnly",
        sellSize,
        sellPrice,
      );
    tx.add(sellTransaction);
    signersArray.push(sellSigners);

    console.log(`Ask placed with price ${sellPrice} and size ${sellSize}`);
  }

  const signersUnion: Signer[] = [...new Set(signersArray.flat())];

  const txSig = await connection.sendTransaction(tx, signersUnion);

  await connection.confirmTransaction(txSig, "confirmed");

  console.log(`----- ${orderCount * 2} PlaceOrders Confirmed -----`);
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
    orderCount: Number.parseInt(args.orderCount),
    initialBidSize: Number.parseInt(args.initialBidSize),
    baseGeckoSymbol: args.baseGeckoSymbol,
    quoteGeckoSymbol: args.quoteGeckoSymbol,
  });

  setInterval(async () => {
    await cancelOrders(owner.keypair, serumMarket, connection);
    await placeOrders(owner.keypair, serumMarket, connection, {
      orderCount: Number.parseInt(args.orderCount),
      initialBidSize: Number.parseInt(args.initialBidSize),
      baseGeckoSymbol: args.baseGeckoSymbol,
      quoteGeckoSymbol: args.quoteGeckoSymbol,
    });
  }, 10000);

  if (Number.parseInt(args.duration) > 0) {
    setTimeout(() => {
      console.log(`Exiting Market Maker @ ${process.pid}`);
      process.exit(0);
    }, Number.parseInt(args.duration));
  }
};
