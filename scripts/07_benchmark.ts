import { config } from "dotenv";
import { Wallet } from "ethers";
import { min } from "lodash";
import { getOrderContract, getProviderGasLimit, getWallets, linkPrivateKeys, stubSolidityOrders } from "./common";

config({ path: ".env" });


async function main(numOps:number, cancelBatchSize:number){
    // add accounts to w3
    linkPrivateKeys()

    const wallets: Wallet[] = getWallets(numOps)
    const gasLimit = await getProviderGasLimit()
    const orderContract = await getOrderContract()
    const cancelOrders = stubSolidityOrders(cancelBatchSize)

    let i = 0;
    let timeElapsed: number[] = []
    while(i < numOps) {   
        var start = process.hrtime()
        const tx = orderContract.connect(wallets[i]).cancelOrders(cancelOrders, {gasLimit:gasLimit})
        try {
            const resp = await((await tx).wait());        
        } catch(ex) {
            console.error(ex)
        }
        // stop time
        timeElapsed.push(process.hrtime(start)[1]/1000000)
        i++;
    } 

    let maxTime = -1
    let minTime = Infinity
    let avgTime  = 0;
    i = 0;
    while(i < timeElapsed.length) {
        avgTime += timeElapsed[i]
        if(timeElapsed[i] > maxTime) {
            maxTime = timeElapsed[i]
        }
        if(timeElapsed[i] < minTime) {
            minTime = timeElapsed[i]
        }
        i++;
    }
    avgTime = avgTime / timeElapsed.length
    console.log(timeElapsed)
    console.log("batch size = %i", cancelBatchSize)
    console.log("minimum time = %f ms", cancelBatchSize, minTime)
    console.log("maximum time = %f ms", cancelBatchSize, maxTime)
    console.log("average time = %f ms", cancelBatchSize, avgTime)
}

if (require.main === module) {
    if(process.argv.length != 4){
        console.error("Error: Provide the number of operations to be performed and size of the cancel batch: yarn benchmark:batch_cancel_gas <num_ops> <cancel_batch_size>")
        process.exit(1)
    }

    main(Number(process.argv[2]), Number(process.argv[3]));
}
