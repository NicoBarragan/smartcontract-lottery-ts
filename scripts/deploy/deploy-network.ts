import { ethers, network } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { deployRaffle } from "./deploy-raffle";
import { BigNumber } from "ethers";
import { Raffle } from "../../typechain";
import { verify } from "../utils/verify";
const logger = require("pino")();

const { VRF_COORDINATOR_V2, KEY_HASH, SUBSCRIPTION_ID } = process.env;

// run script for deploy
export async function networkDeploy() {
    const entranceFee = ethers.utils.parseEther("0.001");
    const callbackGasLimit = BigNumber.from("500000");
    const keeperInterval = BigNumber.from(30); // seconds

    let raffleContract: Raffle;

    logger.info(`The network name is ${network.name}`);
    if (network.name === ("hardhat" || "localhost" || "network")) {
        logger.warn("This script is for tstnets or mainnet only");
        return;
    }

    try {
        logger.info(`Deploying the Raffle contract on the chain...`);
        raffleContract = await deployRaffle(
            entranceFee,
            `${VRF_COORDINATOR_V2}`,
            `${KEY_HASH}`,
            BigNumber.from(`${SUBSCRIPTION_ID}`),
            callbackGasLimit,
            keeperInterval
        );
        logger.info(`Strategy contract deployed to: ${raffleContract.address}`);

        const args = [
            entranceFee,
            `${VRF_COORDINATOR_V2}`,
            `${KEY_HASH}`,
            BigNumber.from(`${SUBSCRIPTION_ID}`),
            callbackGasLimit,
            keeperInterval,
        ];

        logger.info("Verifying...");
        await verify(raffleContract.address, args);
        logger.info("Verified!");

        return { raffleContract, null: null };
    } catch (err) {
        logger.error(err);
        process.exitCode = 1;
    }
}

networkDeploy();
