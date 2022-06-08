# Serum DevTools 🛠️

A developer tooling SDK for building on [serum-dex](https://github.com/project-serum/serum-dex/).

## Prerequisites

You will need to use the `FileKeypair` class that extends the [`Keypair`](https://solana-labs.github.io/solana-web3.js/classes/Keypair.html) class from [`@solana/web3.js`](https://npmjs.com/package/@solana/web3.js) to provide easy file-based keypair management, which is required for the market making features provided by this package.

```
const owner = FileKeypair.generate("./scripts/keys/owner.json");

const airdropSig = await connection.requestAirdrop(
    owner.keypair.publicKey,
    10 * LAMPORTS_PER_SOL,
);
await connection.confirmTransaction(airdropSig);
```

You need to have a [serum-dex](https://github.com/project-serum/serum-dex/) program deployed on the cluster you wish to interact with.

You can either,

- Use the [serum-dev-tools CLI](https://github.com/project-serum/serum-dev-tools/tree/main/cli) to deploy the program.

- use the already deployed `serum-dex` programs, `9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin` on **mainnet-beta** and `DESVgJVGajEgKGXhb6XmqDHGz3VjdgP7rEVESBgxmroY` on **devnet**.

## Get Started

### Initialize a `Dex`

```
const connection = new Connection("http://localhost:8899", "confirmed");

const dexAddress = new PublicKey(
    "7zo7HCQAZPRb4pYiQQ6fLjC8ssN3E8LkavVs8JUA5NMn"
);

const dex = new Dex(dexAddress, connection);
```

### Create `Coin` instances for your `Market`

```
const baseCoin = await dex.createCoin(
    "SAYA",
    9,
    owner.keypair,
    owner.keypair,
    owner.keypair,
);

const quoteCoin = await dex.createCoin(
    "SRM",
    9,
    owner.keypair,
    owner.keypair,
    owner.keypair,
);

// Fund the FileKeypair object to place orders.

await baseCoin.fundAccount(1000000, owner.keypair, connection);

await quoteCoin.fundAccount(2000000, owner.keypair, connection);

```

### Initialize a `Market`

```
const market = await dex.initDexMarket(
    owner.keypair,
    baseCoin,
    quoteCoin,
    {
        lotSize: 1e-3,
        tickSize: 1e-2,
    }
);
```

### Run a Market Maker

```
dex.runMarketMaker(
    market,
    owner,
    {
        durationInSecs: 30,
        orderCount: 3,
        initialBidSize: 1000,
        baseGeckoSymbol: "solana",
        quoteGeckoSymbol: "usd",
    }
);
```
