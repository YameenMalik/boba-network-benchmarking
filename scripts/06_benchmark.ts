import { config } from "dotenv";
import { Wallet } from "ethers";
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
    // start time
    var start = process.hrtime()
    while(i < numOps) {   
        const tx = orderContract.connect(wallets[i]).cancelOrders(cancelOrders, {gasLimit:gasLimit})
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
