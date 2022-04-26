import { FileKeypair } from "../src";

const main = async () => {
  const keypair = FileKeypair.loadOrGenerate("./test.json");
  console.log(keypair.keypair.publicKey.toString());
};

main();
