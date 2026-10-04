// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { FixpointEscrow } from "../FixpointEscrow.sol";

// Test-only reentrancy attacker. Acts as the seller: it creates an invoice,
// then reenters the escrow from its receive() hook in one of two modes.
// Mode Release reenters release() on incoming HBAR; mode Pay reenters pay().
contract ReentrancyAttacker {
    FixpointEscrow public target;
    uint256 public invoiceId;

    enum Mode {
        Off,
        Release,
        Refund,
        Pay
    }

    Mode public mode;

    constructor(FixpointEscrow target_) {
        target = target_;
    }

    function create(uint256 usdCents, uint64 payBy, uint32 reviewWindow, bytes32 metaHash)
        external
        returns (uint256 id)
    {
        id = target.createInvoice(usdCents, payBy, reviewWindow, metaHash);
        invoiceId = id;
    }

    function setMode(Mode mode_) external {
        mode = mode_;
    }

    function setInvoiceId(uint256 id_) external {
        invoiceId = id_;
    }

    function attackPay(bytes[] calldata priceUpdate) external payable {
        mode = Mode.Pay;
        target.pay{ value: msg.value }(invoiceId, priceUpdate);
    }

    receive() external payable {
        if (mode == Mode.Release) {
            mode = Mode.Off;
            target.release(invoiceId);
        } else if (mode == Mode.Refund) {
            mode = Mode.Off;
            target.refund(invoiceId);
        } else if (mode == Mode.Pay) {
            mode = Mode.Off;
            target.pay(invoiceId, new bytes[](0));
        }
    }
}
