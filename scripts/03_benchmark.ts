import { config } from "dotenv";
import { ethers, Wallet, Contract } from "ethers";
import * as TEST_USDC_ABI from "./ERC20TokenABI.json";
import * as fs from "fs";
import BigNumber from "bignumber.js";
import { toBigNumberStr } from "./helpers";
config({ path: ".env" });


// make sure to deploy the contract before running the script

// BOBA RINKEBY
// const ERC20Address = "0x9D26c400FD09ec73c10A97410a6D295c7E0e8a59";

// BOBA MOONBASE
const ERC20Address = "0x57AB85a85f75fb4E9d2Ee85a28913F2DEe9aD283";

// ARBITRUM
// const ERC20Address = "0x065a8a6aD9a027b834b1a746e0B03e88E8d5D895";

const walletsPath = `${__dirname}/wallets.json`;


const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL as string);
const faucet = new Wallet(process.env.DEPLOYER_PRIVATE_KEY as string, provider); 

const ERC20Token = new Contract(ERC20Address, TEST_USDC_ABI.abi, provider);
let currentSupply:number = 0;


// Write the contract call for which to BENCHMARK the chain
const TASK = async (wallet: Wallet) => {
  return ERC20Token.connect(wallet).mint(ERC20Address, toBigNumberStr(1));
};

// Write any pre-task to be executed BEFORE running the TASK
const PRE_TASK = async () => {
    const supply = await ERC20Token.connect(faucet).totalSupply();
    currentSupply = Number(new BigNumber(supply.toHexString()).toFixed(0))/1e18;
    console.log("-> Initial supply is: ", currentSupply);
};

// Write any post-tasks to be executed AFTER running the TASK
const POST_TASK = async () => {
    const supply = await ERC20Token.connect(faucet).totalSupply();
    currentSupply = Number(new BigNumber(supply.toHexString()).toFixed(0))/1e18;
    console.log("-> Current supply is: ", currentSupply);
};

const delay = (ms:number) => new Promise(resolve => setTimeout(resolve, ms))



async function main(numOps:number){
    const walletsPvtKeys = JSON.parse(fs.readFileSync(walletsPath) as any);
    const numWallets: number = walletsPvtKeys.length;
    const wallets: Wallet[] = walletsPvtKeys.map((key: string) => {
        return new Wallet(key, provider);
    })

    console.log("-> Number of transactions to perform:", numOps);
    console.log("-> Number of wallets:", numWallets);
    numOps = Math.min(numWallets, numOps);
    console.log("-> Performing operations:", numOps);

    // uncomment this piece of code if want to listen to events.
    // note that since not all events are being emitted or received by the
    // listener so the code will not terminate until `eventCount == numOps`
    // condition is met
    
    // let eventCount = 0;
    // // event listener
    // ERC20Token.on("Transfer", (...args:any[])=>{
    //     console.log(`Listener Event Count: ${++eventCount}`);
    //     if(eventCount == numOps){
    //         ERC20Token.removeAllListeners();
    //     }
    // })

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
        waits.push(TASK(wallets[i]));
        i++;
    }
    await Promise.all(waits);
  
    // stop time
    var end = process.hrtime(start)


    console.info('-> Execution time (hr): %ds %dms', end[0], end[1] / 1000000)

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
