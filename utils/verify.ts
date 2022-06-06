import "@nomiclabs/hardhat-ethers";
import { BigNumber } from "ethers";
import { run } from "hardhat";

// we can't have these functions in our `helper-hardhat-config`
// since these use the hardhat library, and it would be a circular dependency

export async function verify(
    contractAddress: string,
    args: (string | BigNumber)[]
) {
    console.log("Verifying contract...");
    try {
        await run("verify:verify", {
            address: contractAddress,
            constructorArguments: args,
        });
    } catch (err: any) {
        if (err.message.toLowerCase().includes("already verified")) {
            console.log("Already verified!");
        } else {
            console.log(err);
        }
    }
}
