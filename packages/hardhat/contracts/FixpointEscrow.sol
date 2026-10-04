// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { IPyth, PythPrice } from "./interfaces/IPyth.sol";
import { IHederaTokenService } from "./interfaces/IHederaTokenService.sol";

// USD-priced HBAR escrow. A seller lists a USD amount; the buyer pays the
// HBAR equivalent at a Pyth price and receives an HTS NFT receipt. Held funds
// move only to the seller (release, claim after review) or back to the buyer
// (refund, claim refund). There is no owner, no withdraw path, no
// upgradeability, and the contract never acts as an HTS operator beyond
// minting and delivering the receipt.
contract FixpointEscrow is ReentrancyGuard {
    // HTS system contract. Reserved precompile address 0x167, i.e.
    // 0x0000000000000000000000000000000000000167.
    // Sources: Hedera docs "System Smart Contracts" (HTS row: address 0x167)
    // and hiero-ledger/hiero-contracts contracts/token-service/ (HIP-206/376/514).
    // The constructor accepts an override so unit tests can inject a mock.
    address public constant HTS_PRECOMPILE = address(0x167);

    // Every HTS method reports SUCCESS as response code 22. Source: Hedera docs
    // HTS reference ("@return responseCode ... SUCCESS is 22", repeated per method).
    int64 internal constant HTS_SUCCESS = 22;

    uint256 public constant MAX_STALENESS_SEC = 60;
    uint256 public constant MAX_CONF_BPS = 100;

    // The JSON-RPC relay presents HBAR to the EVM at 18 decimals (wei) while
    // HAPI counts tinybars at 8 decimals, so 1 tinybar = 1e10 wei.
    uint256 internal constant WEI_PER_TINYBAR = 1e10;

    enum State {
        Created,
        Paid,
        Released,
        Refunded,
        Expired
    }

    struct Invoice {
        address seller;
        address buyer;
        uint256 usdCents;
        uint64 payBy;
        uint32 reviewWindow;
        uint64 paidAt;
        uint256 amountHeld;
        bytes32 metadataHash;
        State state;
        int64 receiptSerial;
    }

    IPyth public immutable pyth;
    bytes32 public immutable priceFeedId;
    IHederaTokenService public immutable hts;

    address public receiptToken;
    uint256 public invoiceCount;
    mapping(uint256 => Invoice) public invoices;

    event InvoiceCreated(
        uint256 indexed id, address indexed seller, uint256 usdCents, uint64 payBy, uint32 reviewWindow
    );
    event InvoicePaid(
        uint256 indexed id, address indexed buyer, uint256 amountHeld, uint256 fee, int64 serial
    );
    event InvoiceReleased(uint256 indexed id, address indexed to, uint256 amount);
    event InvoiceRefunded(uint256 indexed id, address indexed to, uint256 amount);
    event InvoiceExpired(uint256 indexed id);
    event PayoutFailed(uint256 indexed id, address indexed to, uint256 amount);
    event ReceiptTokenSet(address indexed token);

    error InvalidAddress();
    error InvalidAmount();
    error InvalidDeadline();
    error InvalidExponent(int32 expo);
    error UnknownInvoice(uint256 id);
    error ReceiptTokenNotSet();
    error ReceiptTokenAlreadySet();
    error SellerCannotPay();
    error InvoiceNotPayable();
    error InvoiceNotPaid();
    error NotBuyer();
    error NotSeller();
    error PaymentTooLate();
    error ReviewWindowActive();
    error RefundNotAvailable();
    error TooEarlyToExpire();
    error NonPositivePrice();
    error StalePrice(uint256 age);
    error WideConfidence(uint256 confBps);
    error InsufficientPayment(uint256 required, uint256 sent);
    error MintFailed(int64 responseCode);
    error NoReceiptSerial();
    error ReceiptTransferFailed(int64 responseCode);
    error ExcessRefundFailed();
    error NothingHeld();

    // pythContract is the Pyth receiver (immutable). feedId is the HBAR/USD
    // feed id resolved off-chain via Hermes (v2/price_feeds?query=HBAR).
    // htsPrecompile overrides the 0x167 precompile for tests; pass address(0)
    // on every real network.
    constructor(address pythContract, bytes32 feedId, address htsPrecompile) {
        if (pythContract == address(0)) revert InvalidAddress();
        pyth = IPyth(pythContract);
        priceFeedId = feedId;
        hts = IHederaTokenService(htsPrecompile == address(0) ? HTS_PRECOMPILE : htsPrecompile);
    }

    // Set once by whoever creates the receipt collection. Payable functions
    // revert with ReceiptTokenNotSet until this is called.
    function setReceiptToken(address token) external {
        if (receiptToken != address(0)) revert ReceiptTokenAlreadySet();
        if (token == address(0)) revert InvalidAddress();
        receiptToken = token;
        emit ReceiptTokenSet(token);
    }

    function createInvoice(uint256 usdCents, uint64 payBy, uint32 reviewWindow, bytes32 metadataHash)
        external
        returns (uint256 id)
    {
        if (usdCents == 0) revert InvalidAmount();
        if (payBy <= block.timestamp) revert InvalidDeadline();
        id = invoiceCount++;
        invoices[id] = Invoice({
            seller: msg.sender,
            buyer: address(0),
            usdCents: usdCents,
            payBy: payBy,
            reviewWindow: reviewWindow,
            paidAt: 0,
            amountHeld: 0,
            metadataHash: metadataHash,
            state: State.Created,
            receiptSerial: 0
        });
        emit InvoiceCreated(id, msg.sender, usdCents, payBy, reviewWindow);
    }

    // Pays the Pyth update fee, reads the price, holds hbarWei, refunds any
    // excess, mints the HTS receipt NFT to the buyer. Every HTS response code
    // must be 22 (SUCCESS) or the whole payment reverts.
    function pay(uint256 id, bytes[] calldata priceUpdate) external payable nonReentrant {
        if (id >= invoiceCount) revert UnknownInvoice(id);
        Invoice storage inv = invoices[id];
        if (inv.state != State.Created) revert InvoiceNotPayable();
        if (receiptToken == address(0)) revert ReceiptTokenNotSet();
        address buyer = msg.sender;
        if (buyer == inv.seller) revert SellerCannotPay();
        if (block.timestamp > inv.payBy) revert PaymentTooLate();

        uint256 fee = pyth.getUpdateFee(priceUpdate);
        if (msg.value < fee) revert InsufficientPayment(fee, msg.value);
        pyth.updatePriceFeeds{ value: fee }(priceUpdate);

        PythPrice memory p = pyth.getPriceNoOlderThan(priceFeedId, MAX_STALENESS_SEC);
        _checkPrice(p);
        uint256 hbarWei = quoteUsdToWei(inv.usdCents, p.price, p.conf, p.expo);
        uint256 required = hbarWei + fee;
        if (msg.value < required) revert InsufficientPayment(required, msg.value);

        inv.state = State.Paid;
        inv.buyer = buyer;
        inv.paidAt = uint64(block.timestamp);
        inv.amountHeld = hbarWei;

        bytes[] memory meta = new bytes[](1);
        meta[0] = abi.encodePacked(id);
        (int64 mintRc,, int64[] memory serials) = hts.mintToken(receiptToken, 0, meta);
        if (mintRc != HTS_SUCCESS) revert MintFailed(mintRc);
        if (serials.length == 0) revert NoReceiptSerial();
        int64 serial = serials[0];
        inv.receiptSerial = serial;

        // Fails with a non-SUCCESS code when the buyer never associated the
        // receipt token; there is no on-chain association getter to check first.
        int64 xferRc = hts.transferNFT(receiptToken, address(this), buyer, serial);
        if (xferRc != HTS_SUCCESS) revert ReceiptTransferFailed(xferRc);

        uint256 excess = msg.value - required;
        if (excess > 0) {
            (bool ok,) = buyer.call{ value: excess }("");
            if (!ok) revert ExcessRefundFailed();
        }
        emit InvoicePaid(id, buyer, hbarWei, fee, serial);
    }

    // Buyer accepts the delivery; held funds go to the seller.
    // If the HBAR payout call fails, funds stay held, PayoutFailed is emitted,
    // and the buyer retries by calling release again.
    function release(uint256 id) external nonReentrant {
        if (id >= invoiceCount) revert UnknownInvoice(id);
        Invoice storage inv = invoices[id];
        if (inv.state != State.Paid) revert InvoiceNotPaid();
        if (msg.sender != inv.buyer) revert NotBuyer();
        _payout(id, inv, inv.seller, State.Released);
    }

    // Seller claims after the buyer went silent past the review window.
    // Same hold-and-retry payout behaviour as release.
    function claimAfterReview(uint256 id) external nonReentrant {
        if (id >= invoiceCount) revert UnknownInvoice(id);
        Invoice storage inv = invoices[id];
        if (inv.state != State.Paid) revert InvoiceNotPaid();
        if (msg.sender != inv.seller) revert NotSeller();
        if (block.timestamp < inv.paidAt + inv.reviewWindow) revert ReviewWindowActive();
        _payout(id, inv, inv.seller, State.Released);
    }

    // Seller voluntarily refunds the buyer. Same hold-and-retry behaviour.
    function refund(uint256 id) external nonReentrant {
        if (id >= invoiceCount) revert UnknownInvoice(id);
        Invoice storage inv = invoices[id];
        if (inv.state != State.Paid) revert InvoiceNotPaid();
        if (msg.sender != inv.seller) revert NotSeller();
        _payout(id, inv, inv.buyer, State.Refunded);
    }

    // Buyer reclaims after the pay-by date passed with no release.
    // Same hold-and-retry behaviour.
    function claimRefundIfExpired(uint256 id) external nonReentrant {
        if (id >= invoiceCount) revert UnknownInvoice(id);
        Invoice storage inv = invoices[id];
        if (inv.state != State.Paid) revert InvoiceNotPaid();
        if (msg.sender != inv.buyer) revert NotBuyer();
        if (block.timestamp <= inv.payBy) revert RefundNotAvailable();
        _payout(id, inv, inv.buyer, State.Refunded);
    }

    // Anyone can expire an invoice nobody paid before the pay-by date.
    function expire(uint256 id) external {
        if (id >= invoiceCount) revert UnknownInvoice(id);
        Invoice storage inv = invoices[id];
        if (inv.state != State.Created) revert InvoiceNotPayable();
        if (block.timestamp <= inv.payBy) revert TooEarlyToExpire();
        inv.state = State.Expired;
        emit InvoiceExpired(id);
    }

    // hbarWei = ceil(usdCents * 1e18 / (100 * price * 10^expo)), rounded up in
    // favour of the seller. Mirrors computeQuote in src/lib/pyth.ts exactly.
    function quoteUsdToWei(uint256 usdCents, int64 price, uint64 conf, int32 expo)
        public
        pure
        returns (uint256 hbarWei)
    {
        _validatePrice(price, conf);
        if (expo > 38 || expo < -38) revert InvalidExponent(expo);
        uint256 priceU = uint256(int256(price));
        uint256 e = uint256(int256(expo < 0 ? -expo : expo));
        uint256 scale = 10 ** e;
        if (expo < 0) {
            return Math.mulDiv(usdCents, 1e18 * scale, 100 * priceU, Math.Rounding.Ceil);
        }
        return Math.mulDiv(usdCents, 1e18, 100 * priceU * scale, Math.Rounding.Ceil);
    }

    // View quote against the receiver's currently stored price. Fresh Hermes
    // update bytes cannot be applied from a view function (parsePriceFeedUpdates
    // is payable and charges a fee), so live UIs fetch them off-chain and
    // submit through pay(); this covers the already-on-chain case.
    function quoteCurrent(uint256 usdCents) external view returns (uint256 hbarWei, uint256 fee) {
        bytes[] memory empty;
        fee = pyth.getUpdateFee(empty);
        PythPrice memory p = pyth.getPriceNoOlderThan(priceFeedId, MAX_STALENESS_SEC);
        _checkPrice(p);
        hbarWei = quoteUsdToWei(usdCents, p.price, p.conf, p.expo);
    }

    function amountHeldTinybar(uint256 id) external view returns (uint64) {
        if (id >= invoiceCount) revert UnknownInvoice(id);
        return _weiToTinybar(invoices[id].amountHeld);
    }

    function _payout(uint256 id, Invoice storage inv, address to, State done) internal {
        uint256 amount = inv.amountHeld;
        if (amount == 0) revert NothingHeld();
        inv.amountHeld = 0;
        (bool ok,) = to.call{ value: amount }("");
        if (!ok) {
            inv.amountHeld = amount;
            emit PayoutFailed(id, to, amount);
            return;
        }
        inv.state = done;
        if (done == State.Released) {
            emit InvoiceReleased(id, to, amount);
        } else {
            emit InvoiceRefunded(id, to, amount);
        }
    }

    function _checkPrice(PythPrice memory p) internal view {
        _validatePrice(p.price, p.conf);
        uint256 age = p.publishTime > block.timestamp ? 0 : block.timestamp - p.publishTime;
        if (age > MAX_STALENESS_SEC) revert StalePrice(age);
    }

    function _validatePrice(int64 price, uint64 conf) internal pure {
        if (price <= 0) revert NonPositivePrice();
        uint256 confBps = (uint256(conf) * 10_000) / uint256(int256(price));
        if (confBps > MAX_CONF_BPS) revert WideConfidence(confBps);
    }

    function _tinybarToWei(uint64 tinybar) internal pure returns (uint256) {
        return uint256(tinybar) * WEI_PER_TINYBAR;
    }

    function _weiToTinybar(uint256 weiAmount) internal pure returns (uint64) {
        return uint64(weiAmount / WEI_PER_TINYBAR);
    }
}
