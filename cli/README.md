# Serum DevTools 🛠️

A developer tooling CLI for building on [serum-dex](https://github.com/project-serum/serum-dex/).

```
cargo install serum-dev-tools
```

### Initialize Workspace

This command initializes a "dev-tools" directory within your current working directory, and stores a binary file for Serum Dex to be deployed, as well as a keypair JSON, whose address the program will be deployed to.

```
serum-dev-tools init
```

### Get Program Address

Get the address at which your Serum Dex program will be deployed to.

```
serum-dev-tools instance
```

### Deploy

Deploy a Serum Dex program into any cluster of your choice.

```
serum-dev-tools localnet
```

---

For a more detailed guide, check out this [article](https://www.wordcelclub.com/sayantan.sol/getting-started-with-serum-dex)
