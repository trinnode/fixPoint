// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

// Minimal mirror of the @pythnetwork/pyth-sdk-solidity surface this escrow uses.
// Verified against the SDK (pyth-network/pyth-sdk-solidity, IPyth.sol):
//   getUpdateFee(bytes[]) -> uint
//   getPriceNoOlderThan(bytes32, uint) -> Price
//   updatePriceFeeds(bytes[]) payable
//   parsePriceFeedUpdates(bytes[], bytes32[], uint64, uint64) payable
// The real SDK splits the Price struct into PythStructs.sol and
// parsePriceFeedUpdates returns PriceFeed[]; this file keeps one self-contained
// interface with the same function names and shapes instead.
struct PythPrice {
    int64 price;
    uint64 conf;
    int32 expo;
    uint256 publishTime;
}

interface IPyth {
    function getUpdateFee(bytes[] calldata updateData) external view returns (uint256 fee);

    function getPriceNoOlderThan(bytes32 id, uint256 age)
        external
        view
        returns (PythPrice memory price);

    function updatePriceFeeds(bytes[] calldata updateData) external payable;

    function parsePriceFeedUpdates(
        bytes[] calldata updateData,
        bytes32[] calldata priceIds,
        uint64 minPublishTime,
        uint64 maxPublishTime
    ) external payable returns (PythPrice[] memory feeds);
}
