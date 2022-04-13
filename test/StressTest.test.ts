import {ethers} from "hardhat";
const { expect } = require("chai");

describe("StressTest contract", function () {
  it("should add a number", async function () {
    const [owner] = await ethers.getSigners();

    const StressTest = await ethers.getContractFactory("StressTest");

    const contract = await StressTest.deploy();

    await contract.addNumber();
    
    expect(+await contract.countNumber()).to.equal(1);
  });
});