import { task } from "hardhat/config";
import { hashBytecode } from "zksync-web3/build/src/utils";
import { ethers } from "ethers";
import { Wallet } from "zksync-ethers";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy/dist/deployer";

task("deploy-erc20-test-setup", "Deploy ERC20 test setup")
  .addParam("deployerPrivateKey", "Deployer private key")
  .addParam("governorPrivateKey", "Deployer private key")
  .addParam("l1BridgePrivateKey", "L1 bridge private key")
  .addParam("salt", "Create2 salt for deployment")
  .setAction(async (taskArgs, hre) => {
    const deployerWallet = new Wallet(taskArgs.deployerPrivateKey);
    const governorWallet = new Wallet(taskArgs.governorPrivateKey);
    const l1BridgeWallet = new Wallet(taskArgs.l1BridgePrivateKey);

    const deployer = new Deployer(hre, deployerWallet, "create2");

    const overrides = {
      customData: { salt: taskArgs.salt },
    };

    const l2TokenImplAddress = await deployer.deploy(await deployer.loadArtifact("L2StandardERC20"), [], overrides);
    const l2Erc20TokenBeacon = await deployer.deploy(
      await deployer.loadArtifact("UpgradeableBeacon"),
      [l2TokenImplAddress.address],
      overrides
    );

    await deployer.deploy(await deployer.loadArtifact("BeaconProxy"), [l2Erc20TokenBeacon.address, "0x"], overrides);

    const beaconProxyBytecodeHash = hashBytecode((await deployer.loadArtifact("BeaconProxy")).bytecode);

    const l2SharedBridgeImpl = await deployer.deploy(await deployer.loadArtifact("L2SharedBridge"), [9], overrides);

    const l2SharedBridgeProxy = await deployer.deploy(
      await deployer.loadArtifact("TransparentUpgradeableProxy"),
      [
        l2SharedBridgeImpl.address,
        governorWallet.address,
        l2SharedBridgeImpl.interface.encodeFunctionData("initialize", [
          unapplyL1ToL2Alias(l1BridgeWallet.address),
          ethers.constants.AddressZero,
          beaconProxyBytecodeHash,
          governorWallet.address,
        ]),
      ],
      overrides
    );

    console.log(l2SharedBridgeProxy.address);
  });

const L1_TO_L2_ALIAS_OFFSET = "0x1111000000000000000000000000000000001111";
const ADDRESS_MODULO = ethers.BigNumber.from(2).pow(160);

export function unapplyL1ToL2Alias(address: string): string {
  // We still add ADDRESS_MODULO to avoid negative numbers
  return ethers.utils.hexlify(
    ethers.BigNumber.from(address).sub(L1_TO_L2_ALIAS_OFFSET).add(ADDRESS_MODULO).mod(ADDRESS_MODULO)
  );
}
