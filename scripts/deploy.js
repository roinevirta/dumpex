// Import ethers from Hardhat package
const hre = require("hardhat");

async function main() {
    // Compile the contract if not already compiled
    await hre.run('compile');

    const DumpEX = await hre.ethers.deployContract("DumpEX");

    console.log("a")
    await DumpEX.waitForDeployment();
    console.log(DumpEX.target);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});