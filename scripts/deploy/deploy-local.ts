import "@nomiclabs/hardhat-ethers";
import { ethers, network } from "hardhat";
import { deployMock } from "../../utils/deploy-mocks";
import { deployRaffle } from "../../utils/deploy-raffle";
import { BigNumber } from "ethers";
import { Raffle, VRFCoordinatorV2Mock } from "../../typechain";
const logger = require("pino")();

// define constants
const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("2");
const ENTRANCE_FEE = ethers.utils.parseEther("0.001");
const CALLBACK_GAS_LIMIT = BigNumber.from("500000");
const KEEPER_INTERVAL = BigNumber.from(30); // seconds

// script for deploy
const localDeploy = async (): Promise<{
    raffleContract: Raffle;
    vrfCoordinatorV2contract: VRFCoordinatorV2Mock;
}> => {
    if (network.name !== ("hardhat" || "localhost")) {
        logger.warn("This script is for a local network only");
        process.exitCode = 1;
    }

    let subscriptionId;
    const keyHash =
        "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc";

    // deploy and get mock contract
    const vrfCoordinatorV2contract =
        (await deployMock()) as VRFCoordinatorV2Mock;
    const vrfCoordinatorV2Address = vrfCoordinatorV2contract.address;

    // create subscription
    const tx = await vrfCoordinatorV2contract.createSubscription();
    const txReceipt = await tx.wait(1); // This receives the events emitted in the tx
    const events = txReceipt.events;
    if (events && events[0].args) {
        subscriptionId = events[0].args.subId;
    }

    // Fund subscription
    await vrfCoordinatorV2contract.fundSubscription(
        subscriptionId,
        VRF_SUB_FUND_AMOUNT
    );

    // deploy the raffle contract to a local network
    const raffleContract = (await deployRaffle(
        ENTRANCE_FEE,
        vrfCoordinatorV2Address,
        keyHash,
        BigNumber.from(subscriptionId),
        CALLBACK_GAS_LIMIT,
        KEEPER_INTERVAL
    )) as Raffle;

    return { raffleContract, vrfCoordinatorV2contract };
};

localDeploy();

export { localDeploy, KEEPER_INTERVAL, CALLBACK_GAS_LIMIT, ENTRANCE_FEE };
