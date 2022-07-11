// the script perform N number of trades, where each trade 
// contains M number of orders.
// 
import * as yargs from "yargs";
import { config } from "dotenv";
import Web3 from "web3";
import {Wallet, Contract, ethers } from "ethers";
import { Account } from "web3-core";
import { MarginBank__factory, PriceOracle__factory } from "@dtradeorg/dtrade-ts/abi/orderbook";
import BigNumber from "bignumber.js";

config({ path: ".env" });

// ----------------------------------------------------------------//
//                          ARGUMENT PARSER
// ----------------------------------------------------------------//
const argv = yargs.options({
    numTrades: {
        alias: "n",
        demandOption: true,
        description: "number of trades to settle on-chain"
    },
    ordersPerTrade: {
        alias: "o",
        demandOption: false,
        description:"number of orders per trade - default is 1 order pair"
    },
    price: {
        alias: "p",
        demandOption: true,
        description:"price at which each trade is to be executed"
    },
    leverage: {
        alias: "l",
        demandOption: true,
        description:"leverage for each trade"
    },
    oraclePriceAtStart: {
        alias: "os",
        demandOption: true,
        description:"price of oracle before performing trades"
    },
    oraclePriceAtEnd: {
        alias: "oe",
        demandOption: true,
        description:"price of oracle after performing trades"
    }
}).argv;  

// ----------------------------------------------------------------//
//                   PROCESS ARGUMENTS/VARIABLES
// ----------------------------------------------------------------//

// process cli arguments
const totalTrades = Number(argv.numTrades);
const orderPerTrade = Number(argv.ordersPerTrade) || 1;
const price = Number(argv.price);
const leverage = Number(argv.leverage);
const oraclePriceAtStart = Number(argv.oraclePriceAtStart);
const oraclePriceAtEnd = Number(argv.oraclePriceAtEnd);

// process .env variables
const rpcURL = process.env.BOBA_RINKEBY_URL || "";
// this account must have BOBA tokens and should be whitelisted as trade operator
const adminAccountPvtKey = process.env.DEPLOYER_PRIVATE_KEY || "";
// read deployed contract addresses
const deployedContracts = require("../contracts/deployedContracts.json");
const testTokenABI = require("./ERC20TokenABI.json");

// hard coding pair name and chain id;
const PAIR_NAME = "DOT-PERP";
const CHAIN_ID = "1297";

const w3 = new Web3(rpcURL);
const admin = new Wallet(adminAccountPvtKey, new ethers.providers.JsonRpcProvider(rpcURL));

// contract addresses
const MARGIN_BANK_ADDRESS = getAddress("MarginBank");
const TEST_TOKEN_ADDRESS = getAddress("Test_Token");
const PRICE_ORACLE_ADDRESS = getAddress("PriceOracle");

// initialize contracts
const marginBank = MarginBank__factory.connect(MARGIN_BANK_ADDRESS, admin);
const oracle = PriceOracle__factory.connect(PRICE_ORACLE_ADDRESS, admin);
const tokenUSDC = new Contract(TEST_TOKEN_ADDRESS, testTokenABI.abi);


// ----------------------------------------------------------------//
//                          FUNCTIONS
// ----------------------------------------------------------------//

function getAddress(contractName: string): string {
    return (
        // hard-coding chain id and DOT-PERP market name
      deployedContracts[CHAIN_ID][PAIR_NAME][
        contractName
      ].address.toLowerCase() || ""
    );
  }

async function fundWallet(receiverAddress:string, amount:number){
  await (await marginBank.connect(admin).depositToBank(
    receiverAddress,
    new BigNumber(amount * 1e18).toFixed(),
    )).wait();
}

async function createFundedAccounts(numWallets: number) {
    const accounts: Account[] = [];
    // create new wallets, provide them test usdc tokens
    // and lock their collateral in margin bank
    for (let i = 0; i < numWallets; i++) {
      accounts.push(w3.eth.accounts.create());
      w3.eth.accounts.wallet.add(accounts[i].privateKey);
      // assuming 1 mil is enough for performing the trades
      await fundWallet(accounts[i].address, 1_000_000);
    }
  }

async function main() {

  // mint token for admin and provide allowance to margin bank
  console.log("Minting token for faucet")
  await(await tokenUSDC.connect(admin).mint(
    admin.getAddress(),
    new BigNumber(999_000_000_000 * 1e18).toFixed(),
    )).wait();

  console.log("Provide token transfer approval to Margin bank")
  await (await tokenUSDC.connect(admin).approve(
    MARGIN_BANK_ADDRESS,
    new BigNumber(999_000_000_000 * 1e18).toFixed(),
    )).wait();
  
  console.log("Set oracle price at start to: ", oraclePriceAtStart)
  await(await oracle.setPrice(
    PAIR_NAME, 
    new BigNumber(oraclePriceAtStart).shiftedBy(18), 
    new Date().getTime()
    )).wait();


  

  console.log("Set oracle price at end to: ", oraclePriceAtEnd)
  await(await oracle.setPrice(
      PAIR_NAME, 
      new BigNumber(oraclePriceAtEnd).shiftedBy(18), 
      new Date().getTime()
      )).wait();
};

if (require.main === module) {
    main();
  }
  