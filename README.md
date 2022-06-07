# SMARTCONTRACT-LOTTERY-TS

This repo imeplements a **decentralized lottery based on smart contracts**, with its scripts and tests.

It uses _Chainlink Keepers_ for automated tasks and _Chainlink VRF 2_ for randomness.

In this repo you will find the smart contract written in solidity, the deploy scripts and the tests written in typescript.

## Requirements
Install the dependencies with `yarn install`

The requirements are in `.env-sample` file.
You need to setup a .env file for each network that you are going to use.
For example, `.env.rinkeby` for working on rinkeby network, `.env.kovan` for working on kovan network, etc.

You do not need a .env file for working in a local network (like hardhat network)

## How to use it
There are different files depending on which environment you will use.
If you are going to use the hardhat network, run
`hh run scripts/deploy/deploy-local.ts`

Otherwise, if you are goint to use the mainnet or a testnet run (in this example, rinkeby)
`hh run scripts/deploy/deploy-network.ts --network rinkeby`

And is similar for testing.
for unit tests you will need a local network:
`hh test`

And for integration (or stagging tests) you will need a testnet (in this example, rinkeby):
`hh test --network rinkeby`
