# Serum DevTools 🛠️

A developer tooling suite for building on Serum.

## Dev Setup

1. Get a local validator running
```
solana-test-validator -r
```

2. Init `serum-dev-tools` CLI in the `/cli` directory
```
cd cli && cargo run -- init
```

3. Deploy `serum-dex` on localnet using the CLI
```
cd cli && cargo run -- deploy l
```

4. Install node packages and update `dexAddress` in `/ts/tests/dev.spec.ts` to the deployed program ID.
```
cd ts && yarn install
```

5. Run tests
```
cd ts && yarn test
```

