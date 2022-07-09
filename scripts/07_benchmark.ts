import { config } from "dotenv";
import { ethers, Wallet } from "ethers";
import Web3 from "web3";
import * as fs from "fs";
import BigNumber from "bignumber.js";
import * as orderbook from "@firefly-exchange/library/dist/src/contracts/exchange";
import { Price, Fee } from "@firefly-exchange/library/dist/src/classes";
import { ADDRESSES, INTEGERS, PRICES } from "@firefly-exchange/library/dist/src/constants";
import { OrderSigner } from "@firefly-exchange/library/dist/src/classes";
import { Order } from "@firefly-exchange/library/dist/src/interfaces";

config({ path: ".env" });

// BOBA MOONBASE
const ordersAddress = "0x38a2d134C11ec66eBFD5D8eF59CE06cfFd02832e";

const walletsPath = `${__dirname}/wallets.json`;

const w3 = new Web3(process.env.RPC_URL as string);
const provider = new ethers.providers.JsonRpcProvider(process.env.BOBA_MOONBASE_URL as string);
const faucet = new Wallet(process.env.DEPLOYER_PRIVATE_KEY as string, provider); 

const orderFactory = new orderbook.Orders__factory(faucet);
const OrderContract = orderFactory.attach(ordersAddress);

// make sure these accounts have USDT in margin bank
let accounts = [
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

const orderAmount = new BigNumber(1e18);
const limitPrice = new Price('100');
const defaultOrder: Order = {
    limitPrice,
    isBuy: true,
    reduceOnly: false,
    quantity: orderAmount,
    triggerPrice: PRICES.NONE,
    limitFee: Fee.fromBips(0),
    leverage: new BigNumber(1).times(1e18),
    maker: ADDRESSES.ZERO,
    taker: ADDRESSES.ZERO,
    expiration: INTEGERS.ONE_YEAR_IN_SECONDS.times(100),
    salt: new BigNumber('425'),
};

async function main(numOps:number, cancelBatchSize:number){
    // add accounts to w3
    accounts.map((acct) => {
        w3.eth.accounts.wallet.add(acct.privateKey);
    });
          
    const walletsPvtKeys = JSON.parse(fs.readFileSync(walletsPath) as any);
    const numWallets: number = walletsPvtKeys.length;
    numOps = Math.min(numWallets, numOps);
    const wallets: Wallet[] = walletsPvtKeys.map((key: string) => {
        return new Wallet(key, provider);
    })

    const gasLimit = (await provider.getBlock('latest')).gasLimit

    const cancelOrders = [];
    let j = 0;
    while(j < cancelBatchSize) {
        cancelOrders.push(await OrderSigner.orderToSolidity(
            { ...defaultOrder, salt: new BigNumber('2425'), limitPrice: new Price(Math.floor(Math.random() * 100)) }
        ))
        j += 1
    }

    let i = 0;
    // start time
    var start = process.hrtime()
    while(i < numOps) {   
        const tx = OrderContract.connect(wallets[i]).cancelOrders(cancelOrders, {gasLimit:gasLimit})
        try {
            const resp = await((await tx).wait());        
            console.log("batch cancel used %d gas unit against a limit of %d", +resp.gasUsed, gasLimit);    
        } catch(ex) {
            console.error(ex)
        }
        i++;
    }


    // stop time
    var end = process.hrtime(start)

    console.info('-> RPC call response time: %ds %dms', end[0], end[1] / 1000000)
}

if (require.main === module) {
    if(process.argv.length != 4){
        console.error("Error: Provide the number of operations to be performed and size of the cancel batch: yarn benchmark:batch_cancel_gas <num_ops> <cancel_batch_size>")
        process.exit(1)
    }

    main(Number(process.argv[2]), Number(process.argv[3]));
}
