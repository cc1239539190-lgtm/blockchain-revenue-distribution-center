// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "../src/RevenueBatchRegistry.sol";
import "../src/CreatorRevenueDistributor.sol";

interface Vm {
    function envOr(string calldata key, uint256 defaultValue) external returns (uint256 value);
    function envOr(string calldata key, address defaultValue) external returns (address value);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
    function addr(uint256 privateKey) external returns (address);
    function projectRoot() external view returns (string memory);
    function serializeAddress(string calldata objectKey, string calldata valueKey, address value)
        external
        returns (string memory json);
    function serializeUint(string calldata objectKey, string calldata valueKey, uint256 value)
        external
        returns (string memory json);
    function writeJson(string calldata json, string calldata path) external;
}

contract Deploy {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 internal constant DEFAULT_DEPLOYER_KEY =
        0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    uint256 internal constant DEFAULT_CREATOR_KEY =
        0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
    address internal constant DEFAULT_COLLABORATOR_A = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;
    address internal constant DEFAULT_COLLABORATOR_B = 0x90F79bf6EB2c4f870365E785982E1f101E93b906;

    function run() external {
        uint256 deployerKey = vm.envOr("PRIVATE_KEY", DEFAULT_DEPLOYER_KEY);
        address collaboratorA = vm.envOr("COLLABORATOR_A_ADDRESS", DEFAULT_COLLABORATOR_A);
        address collaboratorB = vm.envOr("COLLABORATOR_B_ADDRESS", DEFAULT_COLLABORATOR_B);
        uint256 creatorKey = vm.envOr("CREATOR_PRIVATE_KEY", DEFAULT_CREATOR_KEY);
        address creator = vm.addr(creatorKey);
        address owner = vm.addr(deployerKey);
        uint256 startBlock = block.number + 1;

        vm.startBroadcast(deployerKey);

        RevenueBatchRegistry registry = new RevenueBatchRegistry(owner);
        CreatorRevenueDistributor distributor = new CreatorRevenueDistributor(owner, address(registry));
        registry.setPublishOperator(address(distributor));

        vm.stopBroadcast();

        _writeDeploymentManifest(
            owner,
            creator,
            collaboratorA,
            collaboratorB,
            address(registry),
            address(distributor),
            startBlock
        );
    }

    function _writeDeploymentManifest(
        address owner,
        address creator,
        address collaboratorA,
        address collaboratorB,
        address registry,
        address distributor,
        uint256 startBlock
    ) internal {
        string memory path = string.concat(vm.projectRoot(), "/deployments/local.json");

        vm.serializeAddress("deployment", "owner", owner);
        vm.serializeAddress("deployment", "creator", creator);
        vm.serializeAddress("deployment", "collaboratorA", collaboratorA);
        vm.serializeAddress("deployment", "collaboratorB", collaboratorB);
        vm.serializeAddress("deployment", "batchRegistryAddress", registry);
        vm.serializeAddress("deployment", "distributorAddress", distributor);
        vm.serializeUint("deployment", "startBlock", startBlock);

        string memory json = vm.serializeUint("deployment", "chainId", 31337);
        vm.writeJson(json, path);
    }
}
