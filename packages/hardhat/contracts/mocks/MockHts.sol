// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

// Test-only stand-in for the HTS system contract. Exposes the same ABI surface
// the escrow calls (mintToken / transferNFT / associateToken) with configurable
// response codes and a per-token association map.
// The NOT_ASSOCIATED / NOT_OWNER sentinels are mock-scoped (2001 / 2002) so a
// test can never mistake them for a real HTS response code; the escrow only
// branches on SUCCESS (22) versus anything else.
contract MockHts {
    int64 public constant SUCCESS = 22;
    int64 public constant NOT_ASSOCIATED = 2001;
    int64 public constant NOT_OWNER = 2002;

    int64 public mintCode = 22;
    int64 public transferCode = 22;

    mapping(address => mapping(address => bool)) public associated;
    mapping(address => mapping(int64 => address)) public ownerOf;
    mapping(address => uint64) public totalMinted;
    int64 public nextSerial = 1;

    function setAssociated(address token, address account, bool value) external {
        associated[token][account] = value;
    }

    function setMintCode(int64 code) external {
        mintCode = code;
    }

    function setTransferCode(int64 code) external {
        transferCode = code;
    }

    function mintToken(address token, int64, bytes[] memory)
        external
        returns (int64 responseCode, int64 newTotalSupply, int64[] memory serialNumbers)
    {
        if (mintCode != SUCCESS) {
            return (mintCode, 0, new int64[](0));
        }
        int64 serial = nextSerial++;
        totalMinted[token] += 1;
        ownerOf[token][serial] = msg.sender;
        serialNumbers = new int64[](1);
        serialNumbers[0] = serial;
        return (SUCCESS, int64(totalMinted[token]), serialNumbers);
    }

    function transferNFT(address token, address sender, address recipient, int64 serial)
        external
        returns (int64 responseCode)
    {
        if (transferCode != SUCCESS) {
            return transferCode;
        }
        if (!associated[token][recipient]) {
            return NOT_ASSOCIATED;
        }
        if (ownerOf[token][serial] != sender) {
            return NOT_OWNER;
        }
        ownerOf[token][serial] = recipient;
        return SUCCESS;
    }

    function associateToken(address account, address token)
        external
        returns (int64 responseCode)
    {
        associated[token][account] = true;
        return SUCCESS;
    }
}
