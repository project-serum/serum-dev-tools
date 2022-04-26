import { Keypair } from "@solana/web3.js";
import fs from "fs";

export class FileKeypair {
  public filePath: string;
  public keypair: Keypair;

  constructor(filePath: string, keypair: Keypair) {
    this.filePath = filePath;
    this.keypair = keypair;
  }

  static load(filePath: string): FileKeypair {
    const fileBuffer = fs.readFileSync(filePath);
    const secretKey: number[] = JSON.parse(fileBuffer.toString());
    const keypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
    return new FileKeypair(filePath, keypair);
  }

  static generate(filepath: string): FileKeypair {
    const keypair = Keypair.generate();
    const secretKey = Array.from(keypair.secretKey);
    fs.writeFileSync(filepath, JSON.stringify(secretKey));
    return new FileKeypair(filepath, keypair);
  }

  static loadOrGenerate(filePath: string): FileKeypair {
    let keypair: Keypair;
    let secretKey: number[];
    try {
      const fileBuffer = fs.readFileSync(filePath);
      secretKey = JSON.parse(fileBuffer.toString());
      keypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
    } catch (e) {
      keypair = Keypair.generate();
      secretKey = Array.from(keypair.secretKey);
      fs.writeFileSync(filePath, JSON.stringify(secretKey));
    }

    return new FileKeypair(filePath, keypair);
  }

  static withKeypair(filePath: string, keypair: Keypair): FileKeypair {
    const secretKey = Array.from(keypair.secretKey);
    fs.writeFileSync(filePath, JSON.stringify(secretKey));

    return new FileKeypair(filePath, keypair);
  }
}
