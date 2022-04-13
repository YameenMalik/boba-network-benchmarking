import {ethers} from "hardhat";
import * as fs from "fs";

async function main() {
    const [deployer] = await ethers.getSigners();
  
    console.log("Deploying contracts with the account:", deployer.address);
  
    console.log("Account balance:", (await deployer.getBalance()).toString());
  
    const StressTest = await ethers.getContractFactory("StressTest");
    const contract = await StressTest.deploy();
  
    console.log("StressTest contract address:", contract.address);

    fs.writeFileSync("./deployedContracts.json", JSON.stringify({"StressTest": contract.address}));
  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });