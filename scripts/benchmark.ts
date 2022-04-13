import { config } from "dotenv";
import { ethers, Wallet } from "ethers";
import { StressTest__factory } from "../artifacts/typechain";
import * as fs from "fs";
config({ path: ".env" });


// make sure to deploy the contract before running the script
const contractAddresses = require("../deployedContracts.json")["StressTest"];
const walletsPath = `${__dirname}/wallets.json`;


const provider = new ethers.providers.JsonRpcProvider(process.env.BOBA_RINKEBY_URL as string);
const faucet = new Wallet(process.env.DEPLOYER_PRIVATE_KEY as string, provider); 

const stressTestFactory = new StressTest__factory(faucet);
const stressTest = stressTestFactory.attach(contractAddresses);


// Write the contract call for which to BENCHMARK the chain
const TASK = async (wallet: Wallet) => {
  return stressTest.connect(wallet).addNumber();
};

// Write any pre-task to be executed BEFORE running the TASK
const PRE_TASK = async () => {
    const number = +await stressTest.connect(faucet).countNumber();
    console.log("-> Initial Number is: ", number);
};

// Write any post-tasks to be executed AFTER running the TASK
const POST_TASK = async () => {
    const number = +await stressTest.connect(faucet).countNumber();
    console.log("-> Current Number is: ", number);
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
    console.log("-> Perofrming operations:", numOps);

    let eventCount = 0;
    // event listener
    stressTest.on("AddNumber", (...args:any[])=>{
        console.log(`Listener Event Count: ${++eventCount} - AddNumber(${+args[0]})`);
        if(eventCount == numOps){
            stressTest.removeAllListeners();
        }
    })

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
