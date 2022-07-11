# boba-network-benchmarking
Script to test out the TPS of boba network

### how to use
- Install dependencies using `npm i`

- Update .env file

- Compile contracts and typechain factories using: `yarn compile`

- Run unit tests using: `yarn test` ( Specify NETWORK as 'hardhat' in .env )

- Deploy contract on Boba Rinkeby Testnet by:
    1. Update .env file with a deployer account and network url for Boba network
    2. Run `yarn deploy:boba` to deploy on boba rinkeby test network

- To run dummy contract benchmark run `yarn benchmark:mock <num_ops>`
- To run trades benchmark run `yarn benchmark:trades <num_ops>`
- To run batch trades gas benchmark run `yarn benchmark:trades_gas <num_ops> <batch_size>`

 Please ensure that 'scripts/wallets.json` must contain enough private keys to perform `num_ops` transactions. If the num wallets < num_ops then the number of transactions performed will be equal to num_wallets.

### Liquidation benchmarks
The script creates and funds required account for the benchmark. The script wi

To see available cli args, run `yarn benchmark:liquidations --help`

A possible configuration of params looks like this:
`yarn benchmark:liquidations --numTrades 1 --ordersPerTrade 1 --price 10 --leverage 1 --oraclePriceAtStart 10 --oraclePriceAtEnd 15 --makerSideLong --fundFaucet` 