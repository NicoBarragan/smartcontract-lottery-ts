import { network, ethers } from "hardhat";
import { BigNumber, logger, Wallet } from "ethers";
import { Raffle, VRFCoordinatorV2Mock } from "../../typechain";
import { assert, expect } from "chai";
import {
    localDeploy,
    KEEPER_INTERVAL,
    ENTRANCE_FEE,
} from "../../scripts/deploy-local";

if (network.name !== ("hardhat" || "localhost")) {
    describe.skip;
} else {
    describe("Raffle Unit Tests", async () => {
        let ownerWallet: Wallet;
        let vrfCoordinatorV2Mock: VRFCoordinatorV2Mock;
        let raffle: Raffle;

        beforeEach(async () => {
            ownerWallet = ethers.Wallet.createRandom().connect(ethers.provider);

            // send 1 eth from signer(0) to random ownerWallet
            const signer = ethers.provider.getSigner(0);
            await signer.sendTransaction({
                to: ownerWallet.address,
                value: ethers.utils.parseEther("1.0"),
            });

            const { raffleContract, vrfCoordinatorV2contract } =
                await localDeploy();

            raffle = raffleContract;
            vrfCoordinatorV2Mock = vrfCoordinatorV2contract;
        });

        describe("Raffle constructor", async () => {
            it("initializes the raffle correctly", async () => {
                // ideally 1 assert per 'it' (not this case)
                const raffleState = await raffle.getRaffleState();
                const interval = await raffle.getInterval();

                // we stringify the raffleState because is a BigNumber
                assert.equal(raffleState.toString(), "0");
                assert.equal(interval.toString(), KEEPER_INTERVAL.toString());
                // TODO(nb): keep with other params
            });
        });

        describe("enterRaffle", async () => {
            it("reverts when you don't pay enough", async () => {
                // const tx = await raffle.enterRaffle({
                //     from: ownerWallet,
                //     value: BigNumber.from((ENTRANCE_FEE / 2).toString()),
                // });
                console.log(ENTRANCE_FEE);
                await expect(raffle.enterRaffle()).to.be.revertedWith(
                    "Raffle__NotEnoughETHEntered"
                );
            });

            it("records players when they enter");
        });
    });
}
