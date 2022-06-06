// In the unit tests we pretend to be chainlink keepers
// and VRF by  mocking them, but we are not.
// The problem is that maybe we are doing something wrong that in a real network could fail
// For that reason we need to test that in a testnet too.

/* For implementing the scripts on a real network we first need to:
 * 1. Get our SubId for VRF
 * 2. Deploy our contract using that SubId
 * 3. Register the contract with Chainlink VRF & its SubId
 * 4. Register the contract with Chainlink Keepers
 */

import { network, ethers } from "hardhat";
import { BigNumber, logger } from "ethers";
// eslint-disable-next-line camelcase
import { Raffle__factory, Raffle } from "../../typechain";
import { assert, expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const { RAFFLE_CONTRACT_ADDRESS, ENTRANCE_FEE } = process.env;
const GAS_LIMIT = 20740401;

if (network.name === ("hardhat" || "localhost")) {
    logger.info("Only for testnet or mainnet");
    describe.skip;
} else {
    describe("Raffle Stagging Tests", () => {
        // define variables
        let raffle: Raffle;
        let wallet: SignerWithAddress;

        // define enum for raffle states
        enum RaffleState {
            OPEN,
            CALCULATING,
        }

        // the following will be executed before each test:
        beforeEach(async () => {
            // get our wallet
            [wallet] = await ethers.getSigners();

            raffle = (await ethers.getContractAt(
                Raffle__factory.abi,
                `${RAFFLE_CONTRACT_ADDRESS}`
            )) as Raffle;
        });

        describe("fulfillRandomWords", () => {
            it("Should entered, pick a winner and give the balance correctly", async () => {
                const startingTimestamp = await raffle.getLatestTimestamp();

                // enter the raffle
                logger.info("Entering Raffle...");
                const rafTx = await raffle.enterRaffle({
                    value: BigNumber.from(`${ENTRANCE_FEE}`),
                    from: wallet.address,
                    gasLimit: GAS_LIMIT,
                });
                await rafTx.wait();
                logger.info("Entered Raffle");
                const winnerStartingBalance = await wallet.getBalance();
                logger.info(
                    `Winner starting balance: ${winnerStartingBalance}`
                );

                // setting up listener
                await new Promise((resolve, reject) => {
                    logger.info("Setting up listener...");
                    raffle.once("WinnerPicked", async () => {
                        logger.info("Found the event!");
                        try {
                            const recentWinner = await raffle.getRecentWinner();
                            const raffleState = await raffle.getRaffleState();
                            const winnerEndingBalance =
                                await wallet.getBalance();
                            logger.info(
                                `Winner Ending balance: ${winnerEndingBalance}`
                            );
                            const endingTimestamp =
                                await raffle.getLatestTimestamp();

                            // the Raffle must be reseted
                            await expect(raffle.getPlayer(0)).to.be.reverted;
                            assert.equal(
                                recentWinner.toString(),
                                wallet.address
                            );
                            assert.equal(raffleState, RaffleState.OPEN);
                            assert.equal(
                                winnerEndingBalance.toString(),
                                winnerStartingBalance
                                    .add(BigNumber.from(`${ENTRANCE_FEE}`))
                                    .toString()
                            );
                            assert(endingTimestamp > startingTimestamp);
                            resolve("");
                        } catch (err) {
                            reject(err);
                        }
                    });
                });
            });
        });
    });
}
