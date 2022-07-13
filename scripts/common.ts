import { config } from "dotenv";
import * as fs from "fs";
import { ethers, Wallet } from "ethers";
import * as orderbook from "@firefly-exchange/library/dist/src/contracts/exchange";
import { ADDRESSES, INTEGERS, PRICES } from "@firefly-exchange/library/dist/src/constants";
import { Order } from "@firefly-exchange/library/dist/src/interfaces";
import BigNumber from "bignumber.js";
import { Price, Fee } from "@firefly-exchange/library/dist/src/classes";
import { OrderSigner } from "@firefly-exchange/library/dist/src/classes";
import Web3 from "web3";

config({ path: ".env" });

const ordersAddress = "0x38a2d134C11ec66eBFD5D8eF59CE06cfFd02832e";
const provider = new ethers.providers.JsonRpcProvider(process.env.BOBA_MOONBASE_URL as string);
const walletsPath = `${__dirname}/wallets.json`;
const w3 = new Web3(process.env.RPC_URL as string);


// make sure these accounts have USDT in margin bank
const accounts = [
    {
        // maker of each order
        address: "0x09F3b0322011Fe0E0777339729c4E68e3C060d7E",
        privateKey: "0xa1390889e3b68c3775bc0aa100b0b81f35753bac9153269a1f2111fed6d21481"
    },
    {
        // taker of each order
        address: "0x1E3032A5f1C4be5e398d51e7B05424742701f79C",
        privateKey: "0x02eda4b6404fd4eec6ae4f982fac2cad9f12ceced9fc642f0af6201004f7c8b4"
    }];
    

export function getWallets(numOps: number) {
    const walletsPvtKeys = JSON.parse(fs.readFileSync(walletsPath) as any);
    const numWallets: number = walletsPvtKeys.length;
    numOps = Math.min(numWallets, numOps);
    const wallets: Wallet[] = walletsPvtKeys.map((key: string) => {
        return new Wallet(key, provider);
    })
    return wallets
}

export async function getProviderGasLimit() {
    return (await provider.getBlock('latest')).gasLimit
}

export async function getOrderContract() {
    const faucet = new Wallet(process.env.DEPLOYER_PRIVATE_KEY as string, provider); 
    const orderFactory = new orderbook.Orders__factory(faucet);
    return orderFactory.attach(ordersAddress);
}

export function stubSolidityOrders(numOrders: number) {
    const solOrders: any[] = [];
    let i = 0;
    while(i < numOrders) {
        const order = {
            isBuy: true,
            reduceOnly: false,
            quantity: new BigNumber(1e18),
            triggerPrice: PRICES.NONE,
            limitFee: Fee.fromBips(0),
            leverage: new BigNumber(1).times(1e18),
            maker: ADDRESSES.ZERO,
            taker: ADDRESSES.ZERO,
            limitPrice: new Price(Math.floor(Math.random() * 100)),
            expiration: INTEGERS.ONE_YEAR_IN_SECONDS.times(100),
            salt: new BigNumber('425'),
        } as Order;    
        solOrders.push(OrderSigner.orderToSolidity(order));
        i += 1;
    }
    return solOrders
}

export function linkPrivateKeys() {
    accounts.map((acct) => {
        w3.eth.accounts.wallet.add(acct.privateKey);
    });   
}