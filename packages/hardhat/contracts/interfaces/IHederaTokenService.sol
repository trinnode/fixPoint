// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

// Minimal subset of the Hedera Token Service system contract used by the escrow.
// Signatures verified against hiero-ledger/hiero-contracts
// (contracts/token-service/IHederaTokenService.sol, HIP-206 / HIP-376 / HIP-514):
//   mintToken(address token, int64 amount, bytes[] metadata)
//     returns (int64 responseCode, int64 newTotalSupply, int64[] serialNumbers)
//   transferNFT(address token, address sender, address recipient, int64 serialNumber)
//     returns (int64 responseCode)
//   associateToken(address account, address token) returns (int64 responseCode)
// Every method reports SUCCESS as response code 22 (Hedera docs, each HTS method:
// "@return responseCode The response code for the status of the request. SUCCESS is 22").
interface IHederaTokenService {
    function mintToken(address token, int64 amount, bytes[] memory metadata)
        external
        returns (int64 responseCode, int64 newTotalSupply, int64[] memory serialNumbers);

    function transferNFT(address token, address sender, address recipient, int64 serialNumber)
        external
        returns (int64 responseCode);

    function associateToken(address account, address token)
        external
        returns (int64 responseCode);
}
