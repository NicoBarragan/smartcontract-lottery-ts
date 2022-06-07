import { ethers } from "hardhat";
import { VRFCoordinatorV2Mock } from "../typechain";
// const logger = require("pino")();

// const for deploying the vrf2 coordinator
const BASE_FEE = ethers.utils.parseEther("0.25"); // 0.25 is the premium. It costs 0.25 LINK per request
const GAS_PRICE_LINK = 1e9;

export async function deployMock(): Promise<VRFCoordinatorV2Mock> {
    // logger.info("Local network detected! Deploying Mocks...");

    // get and deploy the mock contract
    const vrfCoordinatorV2Mock = await ethers.getContractFactory(
        "VRFCoordinatorV2Mock"
    );
    const vrfCoordinatorV2contract = await vrfCoordinatorV2Mock.deploy(
        BASE_FEE,
        GAS_PRICE_LINK
    );
    await vrfCoordinatorV2contract.deployed();
    // logger.info(`MockContract deployed at ${vrfCoordinatorV2contract.address}`);

    return vrfCoordinatorV2contract;
}
