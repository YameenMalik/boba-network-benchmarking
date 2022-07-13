// The script perform N number of trades, where each trade 
// contains M number of orders.
// Sets initial and ending oracle price after executing trades
// All takers are to be liquidated

import * as yargs from "yargs";
import { config } from "dotenv";
import Web3 from "web3";
import {Wallet, Contract, ethers } from "ethers";
import { Account } from "web3-core";
import { MarginBank__factory, PriceOracle__factory, PerpetualV1__factory, Liquidation__factory } from "@dtradeorg/dtrade-ts/abi/orderbook";
import { Orders as OrderSigner } from "@dtradeorg/dtrade-ts/abi/orderbook-lib/";
import { generateOrdersWithSettlementSize, transformRawOrderTx } from "./helpers";
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
        alias: "s",
        demandOption: true,
        description:"price of oracle before performing trades"
    },
    oraclePriceAtEnd: {
        alias: "e",
        demandOption: true,
        description:"price of oracle after performing trades"
    },
    makerSideLong: {
      alias: "m",
      type: 'boolean', 
      default: false,
      demandOption: false,
      description:"side of maker will be true(long)/false(short). Default is short"
    },

    fundFaucet: {
      alias: "f",
      type: 'boolean', 
      default: false,
      demandOption: false,
      description:"by default assumes faucet has enough usdc token to distribute"
  }
}).parseSync();  

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
const fundFaucet = Number(argv.fundFaucet);
const makerSideLong = argv.makerSideLong; //maker will be going long and all takers will be short.

let accountsToCreate = (totalTrades * orderPerTrade) + 1; 

if(oraclePriceAtStart == oraclePriceAtEnd){
  console.log('Oracle price at start and end can not be same for liquidations to take place');
  process.exit(1);
}

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
const provider = new ethers.providers.JsonRpcProvider(rpcURL);

// contract addresses
const MARGIN_BANK_ADDRESS = getAddress("MarginBank");
const TEST_TOKEN_ADDRESS = getAddress("Test_Token");
const PRICE_ORACLE_ADDRESS = getAddress("PriceOracle");
const ORDERS_ADDRESS = getAddress("Orders");
const PERPETUAL_ADDRESS = getAddress("PerpetualV1");
const LIQUIDATION_ADDRESS = getAddress("Liquidation");

// initialize contracts
const marginBank = MarginBank__factory.connect(MARGIN_BANK_ADDRESS, admin);
const oracle = PriceOracle__factory.connect(PRICE_ORACLE_ADDRESS, admin);
const perpetual = PerpetualV1__factory.connect(PERPETUAL_ADDRESS, admin);
const liquidation = Liquidation__factory.connect(
  LIQUIDATION_ADDRESS,
  new Wallet(adminAccountPvtKey, new ethers.providers.JsonRpcProvider("https://replica.bobabase.boba.network")
  ));

const tokenUSDC = new Contract(TEST_TOKEN_ADDRESS, testTokenABI.abi);
const orderSigner = new OrderSigner(w3, "Orders", Number(CHAIN_ID), ORDERS_ADDRESS);
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
      console.log(`-- Account # ${i+1}`);
      accounts.push(w3.eth.accounts.create());
      w3.eth.accounts.wallet.add(accounts[i].privateKey);
      // assuming 1 mil is enough for performing the trades
      await fundWallet(accounts[i].address, 1_000_000);
    }
    return accounts;
  }




    
async function main() {

  if(fundFaucet){
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
  }


  console.log(`Creating ${accountsToCreate} accounts and depositing USDC to them`)
  const accounts = await createFundedAccounts(accountsToCreate);

  console.log("Set oracle price at start to: ", oraclePriceAtStart)
  
  await(await oracle.setPrice(
    PAIR_NAME, 
    new BigNumber(oraclePriceAtStart).shiftedBy(18).toFixed(0), 
    new Date().getTime()
    )).wait();


  // create N trades, each with M orders;
  console.log("Performing Trades:")
  for(let i =1; i <= totalTrades; i++) {
    console.log(`-- Trade # ${i}`);

    let accountsToUse = [accounts[0]];
    accountsToUse.push(...accounts.slice(orderPerTrade*(i-1)+1, orderPerTrade*(i)+1));

    const settlementRequest = await generateOrdersWithSettlementSize(
      orderSigner, 
      accountsToUse, 
      orderPerTrade,
      makerSideLong, 
      price, 
      leverage, 
      false // is same account to be used for taker for all orders
      ); 

    const transformedOrder = transformRawOrderTx(settlementRequest.order, orderSigner);

    await(await perpetual.connect(admin).trade(
      transformedOrder.accounts, 
      transformedOrder.trades, 
      {gasLimit: 11_000_000})).wait();
  }

  console.log("Set oracle price at end to: ", oraclePriceAtEnd)
  await(await oracle.setPrice(
      PAIR_NAME, 
      new BigNumber(oraclePriceAtEnd).shiftedBy(18).toFixed(0), 
      new Date().getTime()
      )).wait();

  
  const expectedLiquidations =  totalTrades * orderPerTrade;
  console.log("Expected number of liquidations: ", expectedLiquidations);
  let eventCount = 0;
  const listenerStart = process.hrtime();
  let firstEventTime = process.hrtime();

  liquidation.on("LogLiquidated", (...args:any[])=>{ 

    if(eventCount == 0){
      firstEventTime = process.hrtime();
    }

    console.log(`Liquidation event # ${++eventCount}`)

    if(eventCount == expectedLiquidations){
      var listenerEnd = process.hrtime(listenerStart)
      console.info('-> RPC Call to All Events Receive: %ds %dms', listenerEnd[0], listenerEnd[1] / 1000000)

      var eventListenerEnd = process.hrtime(firstEventTime);
      console.info('-> First to Last Event Receive: %ds %dms', eventListenerEnd[0], eventListenerEnd[1] / 1000000)

      liquidation.removeAllListeners();
      process.exit(0);
    }
  });
}

if (require.main === module) {
    main();
}
  