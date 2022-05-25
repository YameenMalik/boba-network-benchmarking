import { config } from "dotenv";
import { ethers, Wallet } from "ethers";
import Web3 from "web3";
import * as fs from "fs";
import BigNumber from "bignumber.js";
import { orderbook } from "@dtradeorg/dtrade-ts/abi";
import { Orders as OrderSigner } from "@dtradeorg/dtrade-ts/abi/orderbook-lib/";
import { generateOrders, transformRawOrderTx } from "./helpers";
import { Trade } from "./types";
config({ path: ".env" });


// make sure to deploy the contract before running the script
// BOBA RINKEBY
// const perpetualV1Address = "0xE7f98A11D8B7870ceF9243b9153B5e18d2f2dA4e";
// const ordersAddress = "0xb89A6553423863466f95f12066443ad811898B3c";

// BOBA MOONBASE
const perpetualV1Address = "0x52d92ebBe4122d8Ed5394819d302AD234001D2C7";
const ordersAddress = "0x36AAc8c385E5FA42F6A7F62Ee91b5C2D813C451C";


// ARBITRUM
// const perpetualV1Address = "0x4fe5cCC36975DA9Ea03b302B118a6be3455F3153";
// const ordersAddress = "0x905e24367781c232E673cF5F6AE119cA0D061c29";


const walletsPath = `${__dirname}/wallets.json`;

const w3 = new Web3(process.env.RPC_URL as string);
const provider = new ethers.providers.JsonRpcProvider(process.env.BOBA_MOONBASE_URL as string);
const faucet = new Wallet(process.env.DEPLOYER_PRIVATE_KEY as string, provider); 

const perpetualV1Factory = new orderbook.PerpetualV1__factory(faucet);
const PerpetualV1 = perpetualV1Factory.attach(perpetualV1Address);
let currentPositionSize:number = 0;


const replicaProvider = new ethers.providers.JsonRpcProvider("https://replica.bobabase.boba.network");
// const replicaProvider = new ethers.providers.JsonRpcProvider("http://0.0.0.0:8549");
const listenerFaucet = new Wallet(process.env.DEPLOYER_PRIVATE_KEY as string, replicaProvider); 
const perpetualV1Factory2 = new orderbook.PerpetualV1__factory(listenerFaucet);
const perpListener = perpetualV1Factory2.attach(perpetualV1Address);


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


// Write the contract call for which to BENCHMARK the chain
const TASK = async (wallet: Wallet, accounts:string[], trades:Trade[]) => {
    return PerpetualV1.connect(wallet).trade(accounts, trades)
};

// Write any pre-task to be executed BEFORE running the TASK
const PRE_TASK = async () => {
    const balance = await PerpetualV1.getAccountPositionBalance(accounts[0].address);
    currentPositionSize = Number(new BigNumber(balance.size.toHexString()).toFixed(0))/1e18;
    console.log("-> Initial Position Size: ", currentPositionSize);

};

// Write any post-tasks to be executed AFTER running the TASK
const POST_TASK = async () => {
    const balance = await PerpetualV1.getAccountPositionBalance(accounts[0].address);
    currentPositionSize = Number(new BigNumber(balance.size.toHexString()).toFixed(0))/1e18;
    console.log("-> Final Position Size: ", currentPositionSize);
};

const delay = (ms:number) => new Promise(resolve => setTimeout(resolve, ms))


async function main(numOps:number){

    const orderSigner = new OrderSigner(
        w3,
        "Orders",
        await (await provider.getNetwork()).chainId,
        ordersAddress
      );

      
    const walletsPvtKeys = JSON.parse(fs.readFileSync(walletsPath) as any);
    const numWallets: number = walletsPvtKeys.length;
    const wallets: Wallet[] = walletsPvtKeys.map((key: string) => {
        return new Wallet(key, provider);
    })

    console.log("-> Number of transactions to perform:", numOps);
    console.log("-> Number of wallets:", numWallets);
    numOps = Math.min(numWallets, numOps);
    console.log("-> Performing operations:", numOps);

    const chainHead = +await provider.getBlockNumber();
    console.log("-> Chain head at: ", chainHead);

    let eventCount = 0;
    let listenerStart = process.hrtime()
    let firstEventTime = process.hrtime();

    // event listener
    perpListener.on("LogTrade", (...args:any[])=>{
        const eventBlock = args[12]["blockNumber"];
        // ignore events if belongs to block < head of the chain
        if(eventBlock > chainHead){
            // console.log(`Listener Event Count: ${eventCount}`);
            
            // recieving first event, start timer
            if(eventCount == 0){
                firstEventTime = process.hrtime();
            }
            // if event count is equal to number of trades
            if(++eventCount == numOps){
                var listenerEnd = process.hrtime(listenerStart)
                console.info('-> RPC Call to All Events Receive: %ds %dms', listenerEnd[0], listenerEnd[1] / 1000000)

                var eventListenerEnd = process.hrtime(firstEventTime);
                console.info('-> First to Last Event Receive: %ds %dms', eventListenerEnd[0], eventListenerEnd[1] / 1000000)

                PerpetualV1.removeAllListeners();
                process.exit(0);
            }
        } else {
            console.log("Old event from block:", eventBlock );
        }
    })



    // add accounts to w3
    await accounts.map((acct) => {
        w3.eth.accounts.wallet.add(acct.privateKey);
    });
    

    const requests = await generateOrders(orderSigner, accounts, numOps);
    const transformedOrders =   await requests.map(r => {
        return transformRawOrderTx(r.order, orderSigner);
    });

    // wait for 3 sec to give time to event listener to be established
    await delay(3000);

    console.log("### Performing Pre-Tasks ###");
    await PRE_TASK();

    console.log("### Executing batch transactions ###")

    // start time
    var start = process.hrtime()

    const waits = []
    let i = 0;
    while(i < numOps){
        
        // start listener start time the moment first contract call is made
        if(i == 0){
            listenerStart = process.hrtime();
        }

        waits.push(TASK(wallets[i], transformedOrders[i].accounts, transformedOrders[i].trades));
        i++;
    }
    await Promise.all(waits);
  
    // stop time
    var end = process.hrtime(start)


    console.info('-> RPC call response time: %ds %dms', end[0], end[1] / 1000000)

    console.log("### Performing Post-Tasks ###");

    await POST_TASK();

}

if (require.main === module) {
    if(process.argv.length != 3){
        console.error("Error: Provide the number of operations to be performed: yarn benchmark <num_ops>")
        process.exit(1)
    }

    main(Number(process.argv[2]));
  }
