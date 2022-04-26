import { Connection, PublicKey } from "@solana/web3.js";
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

const marketMaker = async (args) => {
  const connection = new Connection(args.rpcEndpoint, "confirmed");

  const serumMarket = await SerumMarket.load(
    connection,
    new PublicKey(args.marketAddress),
    { commitment: "confirmed" },
    new PublicKey(args.programID),
  );

  const owner = FileKeypair.load(args.ownerFilePath);

  const txSig = await DexMarket.placeOrder(
    connection,
    owner.keypair,
    serumMarket,
    "buy",
    1,
    10,
  );

  console.log(`Order Placed: ${txSig}`);

  process.kill(0);
};
