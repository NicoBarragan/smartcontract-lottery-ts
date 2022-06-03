import { network, ethers } from "hardhat";
import { BigNumber, logger, Wallet } from "ethers";
import { Raffle, VRFCoordinatorV2Mock } from "../../typechain";
import { assert, expect } from "chai";
import {
    localDeploy,
    KEEPER_INTERVAL,
    ENTRANCE_FEE,
} from "../../scripts/deploy/deploy-local";

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

            raffle = raffleContract.connect(ownerWallet);
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
                await expect(
                    raffle.enterRaffle({ value: 0 })
                ).to.be.revertedWith("Raffle__NotEnoughETHEntered");
            });

            it("records players when they enter", async () => {
                await raffle.enterRaffle({ value: ENTRANCE_FEE });
                const playerFromContract = await raffle.getPlayer(0);
                assert.equal(playerFromContract, ownerWallet.address);
            });

            it("emits event on enter", async () => {
                await expect(
                    raffle.enterRaffle({ value: ENTRANCE_FEE })
                ).to.emit(raffle, "RaffleEnter");
            });

            it("Doesn't allow entrance when raffle is calculating", async () => {
                await raffle.enterRaffle({ value: ENTRANCE_FEE });

                // we need to perform upkeep, for that, checkUpkeep must be true
                // We have 2 conditions passed to be true, enough players and balance, but
                // 1 of the conditions is that interval must have passed, so for no waiting we need to increase that time
                const interval = await raffle.getInterval();
                await network.provider.send("evm_increaseTime", [
                    interval.toNumber() + 1,
                ]);
                // we make real the time increased by mining the block
                await network.provider.send("evm_mine", []);

                // now we pretend to be the chainlink keeper
                await raffle.performUpkeep([]);

                // we make the assertion
                await expect(
                    raffle.enterRaffle({ value: ENTRANCE_FEE })
                ).to.be.revertedWith("Raffle__NotOpen");
            });
        });
    });
}
