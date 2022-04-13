import {ethers} from "hardhat";
import { StressTest, StressTest__factory } from "../artifacts/typechain/";

const { expect } = require("chai");

describe("StressTest contract", function () {
  it("should add a number", async function () {
    const [owner] = await ethers.getSigners();

    const StressTest = await ethers.getContractFactory("StressTest") as StressTest__factory;

    const contract:StressTest = await StressTest.deploy();

    await contract.addNumber();
    
    expect(+await contract.countNumber()).to.equal(1);
  });
});