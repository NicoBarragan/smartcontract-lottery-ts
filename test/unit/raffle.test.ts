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
        // define variables
        let ownerWallet: Wallet;
        let vrfCoordinatorV2Mock: VRFCoordinatorV2Mock;
        let raffle: Raffle;
        let interval: BigNumber;

        // define enum for raffle states
        enum RaffleState {
            OPEN,
            CALCULATING,
        }

        // the following will be executed before each test:
        beforeEach(async () => {
            // get the owner wallet
            ownerWallet = ethers.Wallet.createRandom().connect(ethers.provider);

            // get signer and send 1 eth from this wallet to the ownerWallet
            const signer = ethers.provider.getSigner(0);
            await signer.sendTransaction({
                to: ownerWallet.address,
                value: ethers.utils.parseEther("1.0"),
            });

            // get the vrfCoordinatorV2Mock and raffleContract (in the hardhat network)
            const { raffleContract, vrfCoordinatorV2contract } =
                await localDeploy();

            // assign owenrWallet as deployer of raffleContract
            raffle = raffleContract.connect(ownerWallet);
            vrfCoordinatorV2Mock = vrfCoordinatorV2contract;

            // get the interval for next asserts in tests
            interval = await raffle.getInterval();
        });

        describe("Raffle constructor", () => {
            it("initializes the raffle correctly", async () => {
                // ideally 1 assert per 'it' (not this case)
                const raffleState = await raffle.getRaffleState();

                // we stringify the raffleState because is a BigNumber
                assert.equal(raffleState, RaffleState.OPEN);
                assert.equal(interval.toString(), KEEPER_INTERVAL.toString());
                // TODO(nb): keep with all the other params
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
                        // Is not like the others since it is override type, not view.
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
                        logger.info(
                            `UpkeepNeeded (must be false): ${upkeepNeeded}`
                        );

                        await expect(
                            raffle.performUpkeep("0x")
                        ).to.be.revertedWith(
                            `Raffle__UpkeepNotNeeded(${ENTRANCE_FEE}, ${1}, ${0})`
                            // If it is only the error name is OK, but I put the params for more specification
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
                        // is events[1], because events[0] was the createSubscription() event (in deploy-local.ts)
                        if (!events || !events[1].args) {
                            // this if is done to avoid errors in typescript because events can be undefined
                            logger.info("event is bad");
                            throw new Error("Bad reading of events");
                        }

                        const { requestId } = events[1].args;
                        logger.info(`The requestId is : ${requestId}`);
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
                    beforeEach(async () => {
                        // other beforeEach, but this only inside the describe (the previous beforeEach works here too)
                        await raffle.enterRaffle({ value: ENTRANCE_FEE });

                        await network.provider.send("evm_increaseTime", [
                            interval.toNumber() + 1,
                        ]);
                        await network.provider.send("evm_mine", []);
                    });

                    it("can only be called after performUpkeep", async () => {
                        await expect(
                            vrfCoordinatorV2Mock.fulfillRandomWords(
                                0, // this could be any number
                                raffle.address
                            )
                        ).to.be.revertedWith("nonexistent request");

                        await expect(
                            vrfCoordinatorV2Mock.fulfillRandomWords(
                                1, // another example of a number only for being sure
                                raffle.address
                            )
                        ).to.be.revertedWith("nonexistent request");
                    });

                    it("picks a winner, resets the lottery and sends the money", async () => {
                        // first, we get some random people to enter the Raffle
                        const additionalEntrants = 3;
                        const startingAccountIndex = 1; // deployer (or ownerWallet) = 0
                        const accounts = await ethers.getSigners();
                        for (
                            let i = startingAccountIndex;
                            i < startingAccountIndex + additionalEntrants;
                            i++
                        ) {
                            const accountConnectedRaffle = raffle.connect(
                                accounts[i]
                            );
                            await accountConnectedRaffle.enterRaffle({
                                value: ENTRANCE_FEE,
                            });
                        } // Total of 4 wallets connected

                        // we get the starting timestamp for comparing in the assert
                        const startingTimestamp =
                            await raffle.getLatestTimestamp();

                        // get the winner balance (we know because we printed) for compare balances in assert
                        const winnerStartingBalance =
                            await accounts[1].getBalance();

                        // we need to listen an event, that is emited when fulfillRandomWords is called
                        await new Promise((resolve, reject) => {
                            // setting up listener
                            raffle.once("WinnerPicked", async () => {
                                logger.info("Found the event!");
                                try {
                                    const recentWinner =
                                        await raffle.getRecentWinner();

                                    // make all of this logger.info for knowing who the winner is
                                    // logger.info("winner: ", recentWinner);
                                    // logger.info(accounts[0].address);
                                    // logger.info(accounts[1].address); // This is the winer!
                                    // logger.info(accounts[2].address);
                                    // logger.info(accounts[3].address);

                                    const raffleState =
                                        await raffle.getRaffleState();
                                    const endingTimestamp =
                                        await raffle.getLatestTimestamp();
                                    const numPlayers =
                                        await raffle.getNumberOfPlayers();

                                    const winnerEndingBalance =
                                        await accounts[1].getBalance();
                                    assert.equal(numPlayers.toString(), "0");
                                    assert.equal(raffleState, RaffleState.OPEN);
                                    assert(endingTimestamp > startingTimestamp);
                                    assert.equal(
                                        recentWinner,
                                        accounts[1].address
                                    );
                                    assert(
                                        winnerEndingBalance.toString(),
                                        winnerStartingBalance
                                            .add(
                                                ENTRANCE_FEE.mul(
                                                    additionalEntrants
                                                ).add(ENTRANCE_FEE)
                                            )
                                            .toString()
                                    );
                                    resolve("");
                                } catch (err) {
                                    reject(err);
                                }
                            });

                            // now we've to execute the mocks of the keeper and the VRF
                            // performUpkeek (mocking Chainlink Keepers), that triggers fulfillRandomWords with the requestId
                            // fulfillRandomWords (mocking chainlink VRF) that emits the event WinnerPicked
                            (async () => {
                                const tx = await raffle.performUpkeep([]);
                                const txReceipt = await tx.wait();
                                const events = txReceipt.events;

                                if (!events || !events[1].args) {
                                    throw new Error("Bad reading of events");
                                }

                                await vrfCoordinatorV2Mock.fulfillRandomWords(
                                    events[1].args.requestId,
                                    raffle.address
                                );
                            })();
                            // TODO(nb): see if is possible to implement this with 'raffle.on("WinnerPicked")'
                        });
                    });
                });
            });
        });
    });
}
