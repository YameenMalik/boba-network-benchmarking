import * as dotenv from "dotenv";
dotenv.config({ path: __dirname + "/.env" });

import "@nomiclabs/hardhat-ethers";

module.exports = {
  solidity: "0.7.5",

  typechain: {
    outDir: "artifacts/typechain",
    target: "ethers-v5",
  },

  defaultNetwork: process.env.NETWORK,

  networks: {
    "hardhat": {
      mining: {
        auto: true,
      },
    },
    "boba-rinkeby-testnet": {
      gas: 'auto',
      gasPrice: 'auto',
      url: process.env.BOBA_RINKEBY_URL as string,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY as string]
    }
  }
};
