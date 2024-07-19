import { Command } from "commander";
import { Wallet } from "ethers";
import { provider } from "./utils";

import { ethTestConfig } from "./deploy-utils";

import { Deployer } from "../../l1-contracts/src.ts/deploy";

export async function initializeChainGovernance(deployer: Deployer, chainId: string) {
  const l1SharedBridge = deployer.defaultSharedBridge(deployer.deployWallet);

  if (deployer.verbose) {
    console.log("Initializing chain governance");
  }
  await deployer.executeUpgrade(
    l1SharedBridge.address,
    0,
    l1SharedBridge.interface.encodeFunctionData("initializeChainGovernance", [
      chainId,
      deployer.addresses.Bridges.L2SharedBridgeProxy,
    ])
  );

  if (deployer.verbose) {
    console.log("L2 shared bridge address registered on L1 via governance");
  }
}

async function main() {
  const program = new Command();

  program.version("0.1.0").name("initialize-chain-governance");

  program
    .option("--private-key <private-key>")
    .option("--gov <gov>")
    .option("--chain-id <chain-id>")
    .action(async (cmd) => {
      const chainId: string = cmd.chainId ? cmd.chainId : process.env.CHAIN_ETH_ZKSYNC_NETWORK_ID;
      const deployWallet = cmd.privateKey
        ? new Wallet(cmd.privateKey, provider)
        : Wallet.fromMnemonic(
            process.env.MNEMONIC ? process.env.MNEMONIC : ethTestConfig.mnemonic,
            "m/44'/60'/0'/0/1"
          ).connect(provider);
      console.log(`Using deployer wallet: ${deployWallet.address}`);

      const deployer = new Deployer({
        deployWallet,
        ownerAddress: deployWallet.address,
        verbose: true,
      });

      deployer.addresses.Governance = cmd.gov ? cmd.gov : deployer.addresses.Governance;

      await initializeChainGovernance(deployer, chainId);
    });

  await program.parseAsync(process.argv);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
