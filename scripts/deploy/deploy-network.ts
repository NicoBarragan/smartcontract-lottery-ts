import { network } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { deployRaffle } from "../../utils/deploy-raffle";
import { BigNumber } from "ethers";
const logger = require("pino")();

// get constants from the .env file
const { VRF_COORDINATOR_V2, KEY_HASH, SUBSCRIPTION_ID, ENTRANCE_FEE } =
    process.env;

// run script for deploy
export async function networkDeploy() {
    if (network.name === ("hardhat" || "localhost" || "network")) {
        logger.error("This script is for testnets or mainnet only");
    }

    // define constants
    const callbackGasLimit = BigNumber.from("500000");
    const keeperInterval = BigNumber.from(30); // seconds

    // deploy the raffle contract to a testnet or mainnet
    try {
        logger.info(`Deploying the Raffle contract on the chain...`);
        await deployRaffle(
            BigNumber.from(`${ENTRANCE_FEE}`),
            `${VRF_COORDINATOR_V2}`,
            `${KEY_HASH}`,
            BigNumber.from(`${SUBSCRIPTION_ID}`),
            callbackGasLimit,
            keeperInterval
        );
    } catch (err) {
        logger.error(err);
    }
}

networkDeploy();
