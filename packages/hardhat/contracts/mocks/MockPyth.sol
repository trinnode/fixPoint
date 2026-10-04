// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IPyth, PythPrice } from "../interfaces/IPyth.sol";

// Test-only Pyth receiver. Implements the same IPyth surface the escrow calls,
// with a configurable price, confidence, exponent, publish time and update fee.
// Unlike the real receiver it does not enforce staleness itself; the escrow's
// own publishTime check is what the tests exercise.
contract MockPyth is IPyth {
    PythPrice private _price;
    uint256 private _fee;

    error InsufficientFee(uint256 required, uint256 sent);

    function setPrice(int64 price, uint64 conf, int32 expo, uint256 publishTime) external {
        _price = PythPrice({ price: price, conf: conf, expo: expo, publishTime: publishTime });
    }

    function setFee(uint256 fee) external {
        _fee = fee;
    }

    function withdraw(address to) external {
        (bool ok,) = to.call{ value: address(this).balance }("");
        require(ok, "withdraw failed");
    }

    function getUpdateFee(bytes[] calldata) external view override returns (uint256 fee) {
        return _fee;
    }

    function getPriceNoOlderThan(bytes32, uint256)
        external
        view
        override
        returns (PythPrice memory price)
    {
        return _price;
    }

    function updatePriceFeeds(bytes[] calldata) external payable override {
        if (msg.value < _fee) revert InsufficientFee(_fee, msg.value);
    }

    function parsePriceFeedUpdates(
        bytes[] calldata,
        bytes32[] calldata priceIds,
        uint64,
        uint64
    ) external payable override returns (PythPrice[] memory feeds) {
        if (msg.value < _fee) revert InsufficientFee(_fee, msg.value);
        feeds = new PythPrice[](priceIds.length);
        for (uint256 i = 0; i < priceIds.length; i++) {
            feeds[i] = _price;
        }
    }
}
