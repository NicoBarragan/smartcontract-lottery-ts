import { ethers } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { BigNumber } from "ethers";
import { Raffle } from "../typechain";
const logger = require("pino")();

// run script for deploy
export async function deployRaffle(
    entranceFee: BigNumber,
    vrfCoordinatorV2Address: string,
    keyHash: string,
    subscriptionId: BigNumber,
    callbackGasLimit: BigNumber,
    keeperInterval: BigNumber
): Promise<any> {
    let contract: Raffle;
    try {
        const RaffleContract = await ethers.getContractFactory("Raffle");

        contract = await RaffleContract.deploy(
            entranceFee,
            vrfCoordinatorV2Address,
            keyHash,
            subscriptionId,
            callbackGasLimit,
            keeperInterval
        );

        await contract.deployed();
        logger.info(`Strategy contract deployed to: ${contract.address}`);
        return contract;
    } catch (err) {
        logger.error(err);
        process.exitCode = 1;
    }
}
