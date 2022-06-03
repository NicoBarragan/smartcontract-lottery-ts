import { ethers, network } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { deployMock } from "./deploy-mocks";
import { deployRaffle } from "./deploy-raffle";
import { BigNumber } from "ethers";
import { Raffle, VRFCoordinatorV2Mock } from "../../typechain";
// const logger = require("pino")();

const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("2");

const ENTRANCE_FEE = ethers.utils.parseEther("0.001");
const CALLBACK_GAS_LIMIT = BigNumber.from("500000");
const KEEPER_INTERVAL = BigNumber.from(30); // seconds

// run script for deploy
const localDeploy = async (): Promise<{
    raffleContract: Raffle;
    vrfCoordinatorV2contract: VRFCoordinatorV2Mock;
}> => {
    let subscriptionId;

    // logger.info(`The network name is ${network.name}`);

    const keyHash =
        "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc";
    const vrfCoordinatorV2contract = await deployMock();
    const vrfCoordinatorV2Address = vrfCoordinatorV2contract.address;
    const tx = await vrfCoordinatorV2contract.createSubscription();
    const txReceipt = await tx.wait(1); // This receives the events emitted in the tx too
    const events = txReceipt.events;
    if (events && events[0].args) {
        subscriptionId = events[0].args.subId;
    }

    // logger.info("Funding subscription...");
    await vrfCoordinatorV2contract.fundSubscription(
        subscriptionId,
        VRF_SUB_FUND_AMOUNT
    );
    // logger.info("Subscription Founded");

    // logger.info(`Deploying the Raffle contract on local network...`);
    const raffleContract = (await deployRaffle(
        ENTRANCE_FEE,
        vrfCoordinatorV2Address,
        keyHash,
        BigNumber.from(subscriptionId),
        CALLBACK_GAS_LIMIT,
        KEEPER_INTERVAL
    )) as Raffle;

    await raffleContract.deployed();

    // logger.info(
    //     `Raffle contract deployed on local network at ${raffleContract.address}`
    // );
    return { raffleContract, vrfCoordinatorV2contract };
};

localDeploy();

export { localDeploy, KEEPER_INTERVAL, CALLBACK_GAS_LIMIT, ENTRANCE_FEE };
