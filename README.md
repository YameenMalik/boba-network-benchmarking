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

- Run benchmarking script using `yarn benchmark <num_ops>`. The script will perform `AddNumber` contract call. Please ensure that 'scripts/wallets.json` must contain enough private keys to perform `num_ops` transactions. If the num wallets < num_ops then the number of transactions performed will be equal to num_wallets.
