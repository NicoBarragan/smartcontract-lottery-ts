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
        let interval: BigNumber;

        enum RaffleState {
            OPEN,
            CALCULATING,
        }

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
            interval = await raffle.getInterval();
        });

        describe("Raffle constructor", () => {
            it("initializes the raffle correctly", async () => {
                // ideally 1 assert per 'it' (not this case)
                const raffleState = await raffle.getRaffleState();

                // we stringify the raffleState because is a BigNumber
                assert.equal(raffleState, RaffleState.OPEN);
                assert.equal(interval.toString(), KEEPER_INTERVAL.toString());
                // TODO(nb): keep with other params
            });
        });

        describe("enterRaffle", () => {
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

            describe("checkUpkeep", () => {
                it("returns false if people haven't sent any ETH", async () => {
                    await network.provider.send("evm_increaseTime", [
                        interval.toNumber() + 1,
                    ]);
                    await network.provider.send("evm_mine", []);
                    const { upkeepNeeded } =
                        // callStatic is for simulating the tx and getting a varible defined in it.
                        // Is not like the others since it doesn't return anything, is not view.
                        await raffle.callStatic.checkUpkeep([]);
                    assert(!upkeepNeeded);
                });

                it("returns false if raffle isn't open", async () => {
                    await raffle.enterRaffle({ value: ENTRANCE_FEE });
                    await network.provider.send("evm_increaseTime", [
                        interval.toNumber() + 1,
                    ]);
                    await network.provider.send("evm_mine", []);
                    await raffle.performUpkeep([]);
                    const raffleState = await raffle.getRaffleState();
                    const { upkeepNeeded } =
                        await raffle.callStatic.checkUpkeep("0x");
                    assert.equal(
                        raffleState === RaffleState.CALCULATING,
                        upkeepNeeded === false
                    );
                });
                it("returns false if interval is not reach yet", async () => {
                    await raffle.enterRaffle({ value: ENTRANCE_FEE });
                    await network.provider.send("evm_increaseTime", [
                        interval.toNumber() + 1,
                    ]);
                    await network.provider.send("evm_mine", []);
                    await raffle.performUpkeep("0x");
                    await network.provider.send("evm_mine", []);
                    const { upkeepNeeded } =
                        await raffle.callStatic.checkUpkeep([]);
                    assert(!upkeepNeeded);
                });

                it("returns true if has enough balance, players and interval is reached", async () => {
                    await raffle.enterRaffle({ value: ENTRANCE_FEE });
                    await network.provider.send("evm_increaseTime", [
                        interval.toNumber() + 1,
                    ]);
                    await network.provider.send("evm_mine", []);
                    const { upkeepNeeded } =
                        await raffle.callStatic.checkUpkeep([]);
                    assert(upkeepNeeded);
                });

                describe("performUpkeep", () => {
                    it("it can only run if checkUpkeep is true", async () => {
                        await raffle.enterRaffle({ value: ENTRANCE_FEE });
                        await network.provider.send("evm_increaseTime", [
                            interval.toNumber() + 1,
                        ]);
                        await network.provider.send("evm_mine", []);

                        const tx = await raffle.performUpkeep([]);
                        assert(tx);
                    });

                    it("emits events with the requestedId", async () => {
                        await raffle.enterRaffle({ value: ENTRANCE_FEE });
                        await network.provider.send("evm_increaseTime", [
                            interval.toNumber() + 1,
                        ]);
                        await network.provider.send("evm_mine", []);

                        await expect(raffle.performUpkeep([])).to.emit(
                            raffle,
                            "RequestedRaffleWinner"
                        );
                    });

                    it("fails if checkUpkeep is false", async () => {
                        await raffle.enterRaffle({ value: ENTRANCE_FEE });
                        const { upkeepNeeded } =
                            await raffle.callStatic.checkUpkeep([]);
                        console.log(
                            `UpkeepNeeded (must be false): ${upkeepNeeded}`
                        );
                        await expect(
                            raffle.performUpkeep("0x")
                        ).to.be.revertedWith(
                            // If it is only the error name is OK, but I put the params for more specification
                            `Raffle__UpkeepNotNeeded(${ENTRANCE_FEE}, ${1}, ${0})`
                        );
                    });

                    it("returns a number for requestedId", async () => {
                        await raffle.enterRaffle({ value: ENTRANCE_FEE });
                        await network.provider.send("evm_increaseTime", [
                            interval.toNumber() + 1,
                        ]);
                        await network.provider.send("evm_mine", []);

                        const tx = await raffle.performUpkeep([]);
                        const txReceipt = await tx.wait();
                        const events = txReceipt.events;

                        // is events[1], becaus events[0] was the createSubscription() event (in deploy-local.ts)
                        if (!events || !events[1].args) {
                            console.log("event is bad");
                            throw new Error("Bad reading of events");
                        }

                        const { requestId } = events[1].args;
                        console.log(`The requestId is : ${requestId}`);
                        assert(requestId.toNumber() > 0);
                    });

                    it("updates the raffle state to CALCULATING", async () => {
                        await raffle.enterRaffle({ value: ENTRANCE_FEE });
                        await network.provider.send("evm_increaseTime", [
                            interval.toNumber() + 1,
                        ]);
                        await network.provider.send("evm_mine", []);

                        await raffle.performUpkeep([]);
                        const raffleState = await raffle.getRaffleState();
                        expect(raffleState).to.equal(RaffleState.CALCULATING);
                    });
                });

                describe("fulfillRandomWords", () => {
                    it("", async () => {});
                });
            });
        });
    });
}
