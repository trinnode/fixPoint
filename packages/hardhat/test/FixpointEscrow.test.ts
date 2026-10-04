import { expect } from "chai";
import { ethers } from "hardhat";

const FEED_ID = ethers.keccak256(ethers.toUtf8Bytes("HBAR/USD"));
const RECEIPT = "0x0000000000000000000000000000000000000777";
const META = ethers.keccak256(ethers.toUtf8Bytes("demo"));
const PRICE = 181_200_000;
const CONF = 410_000;
const EXPO = -8;

function mirrorQuote(usdCents: bigint, price: bigint, conf: bigint, expo: number): bigint {
  let num: bigint;
  let denom: bigint;
  if (expo >= 0) {
    num = usdCents * 10n ** 18n;
    denom = 100n * price * 10n ** BigInt(expo);
  } else {
    const e = BigInt(-expo);
    num = usdCents * 10n ** (18n + e);
    denom = 100n * price;
  }
  return (num + denom - 1n) / denom;
}

async function latest(): Promise<number> {
  return (await ethers.provider.getBlock("latest"))!.timestamp;
}

async function increaseTime(seconds: number): Promise<void> {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}

describe("FixpointEscrow", () => {
  async function fixture() {
    const [deployer, seller, buyer, stranger] = await ethers.getSigners();
    const mockPyth: any = await ethers.deployContract("MockPyth");
    const mockHts: any = await ethers.deployContract("MockHts");
    const escrow: any = await ethers.deployContract("FixpointEscrow", [
      await mockPyth.getAddress(),
      FEED_ID,
      await mockHts.getAddress(),
    ]);
    await escrow.setReceiptToken(RECEIPT);
    await mockPyth.setPrice(PRICE, CONF, EXPO, await latest());
    return { deployer, seller, buyer, stranger, mockPyth, mockHts, escrow };
  }

  async function createPaid(ctx: any, opts: { usdCents?: number; review?: number; fee?: bigint } = {}) {
    const { escrow, mockPyth, mockHts, seller, buyer } = ctx;
    const fee: bigint = opts.fee ?? 0n;
    await mockPyth.setFee(fee);
    const payBy = (await latest()) + 3600;
    const review = opts.review ?? 600;
    const usdCents = opts.usdCents ?? 2500;
    const id: bigint = await escrow.connect(seller).createInvoice.staticCall(usdCents, payBy, review, META);
    await escrow.connect(seller).createInvoice(usdCents, payBy, review, META);
    await mockHts.setAssociated(RECEIPT, buyer.address, true);
    await mockPyth.setPrice(PRICE, CONF, EXPO, await latest());
    const hbarWei: bigint = await escrow.quoteUsdToWei(usdCents, PRICE, CONF, EXPO);
    await escrow.connect(buyer).pay(id, [], { value: hbarWei + fee });
    return { id, hbarWei, fee, payBy, review, usdCents };
  }

  describe("constructor and setReceiptToken", () => {
    it("defaults the HTS address to 0x167 when passed address(0)", async () => {
      const { mockPyth, escrow } = await fixture();
      expect(await escrow.pyth()).to.equal(await mockPyth.getAddress());
      expect(await escrow.priceFeedId()).to.equal(FEED_ID);
      const withDefault: any = await ethers.deployContract("FixpointEscrow", [
        await mockPyth.getAddress(),
        FEED_ID,
        ethers.ZeroAddress,
      ]);
      expect(await withDefault.hts()).to.equal("0x0000000000000000000000000000000000000167");
    });

    it("stores a custom HTS override", async () => {
      const { mockPyth, mockHts } = await (async () => {
        const f = await fixture();
        return f;
      })();
      const escrow: any = await ethers.deployContract("FixpointEscrow", [
        await mockPyth.getAddress(),
        FEED_ID,
        await mockHts.getAddress(),
      ]);
      expect(await escrow.hts()).to.equal(await mockHts.getAddress());
    });

    it("reverts on a zero Pyth address", async () => {
      const factory = await ethers.getContractFactory("FixpointEscrow");
      await expect(factory.deploy(ethers.ZeroAddress, FEED_ID, ethers.ZeroAddress))
        .to.be.revertedWithCustomError(factory, "InvalidAddress");
    });

    it("sets the receipt token once, then reverts", async () => {
      const { escrow } = await fixture();
      await expect(escrow.setReceiptToken(RECEIPT)).to.be.revertedWithCustomError(
        escrow,
        "ReceiptTokenAlreadySet"
      );
    });

    it("reverts setReceiptToken on the zero address", async () => {
      const { mockPyth, mockHts } = await fixture();
      const fresh: any = await ethers.deployContract("FixpointEscrow", [
        await mockPyth.getAddress(),
        FEED_ID,
        await mockHts.getAddress(),
      ]);
      await expect(fresh.setReceiptToken(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        fresh,
        "InvalidAddress"
      );
    });

    it("pay reverts with ReceiptTokenNotSet until set", async () => {
      const { mockPyth, mockHts, seller, buyer } = await fixture();
      const fresh: any = await ethers.deployContract("FixpointEscrow", [
        await mockPyth.getAddress(),
        FEED_ID,
        await mockHts.getAddress(),
      ]);
      const payBy = (await latest()) + 3600;
      await fresh.connect(seller).createInvoice(2500, payBy, 600, META);
      await expect(fresh.connect(buyer).pay(0, [])).to.be.revertedWithCustomError(
        fresh,
        "ReceiptTokenNotSet"
      );
    });
  });

  describe("createInvoice", () => {
    it("stores the invoice and emits InvoiceCreated", async () => {
      const { escrow, seller } = await fixture();
      const payBy = (await latest()) + 3600;
      await expect(escrow.connect(seller).createInvoice(2500, payBy, 600, META))
        .to.emit(escrow, "InvoiceCreated")
        .withArgs(0, seller.address, 2500, payBy, 600);
      const inv = await escrow.invoices(0);
      expect(inv.seller).to.equal(seller.address);
      expect(inv.usdCents).to.equal(2500);
      expect(inv.payBy).to.equal(payBy);
      expect(inv.reviewWindow).to.equal(600);
      expect(inv.metadataHash).to.equal(META);
      expect(inv.state).to.equal(0);
      expect(await escrow.invoiceCount()).to.equal(1);
    });

    it("increments ids", async () => {
      const { escrow, seller } = await fixture();
      const payBy = (await latest()) + 3600;
      await escrow.connect(seller).createInvoice(100, payBy, 0, META);
      await escrow.connect(seller).createInvoice(200, payBy, 0, META);
      expect(await escrow.invoiceCount()).to.equal(2);
    });

    it("reverts on zero amount", async () => {
      const { escrow, seller } = await fixture();
      await expect(
        escrow.connect(seller).createInvoice(0, (await latest()) + 100, 0, META)
      ).to.be.revertedWithCustomError(escrow, "InvalidAmount");
    });

    it("reverts on a past pay-by date", async () => {
      const { escrow, seller } = await fixture();
      await expect(
        escrow.connect(seller).createInvoice(100, (await latest()) - 10, 0, META)
      ).to.be.revertedWithCustomError(escrow, "InvalidDeadline");
    });
  });

  describe("pricing", () => {
    it("matches the TS mirror on an exact vector", async () => {
      const { escrow } = await fixture();
      const hbarWei: bigint = await escrow.quoteUsdToWei(10_000, 20_000_000, 10_000, -8);
      expect(hbarWei).to.equal(mirrorQuote(10_000n, 20_000_000n, 10_000n, -8));
      expect(hbarWei).to.equal(500n * 10n ** 18n);
    });

    it("matches the mirror across expo signs", async () => {
      const { escrow } = await fixture();
      const cases: Array<[bigint, bigint, bigint, number]> = [
        [2500n, 181200000n, 410000n, -8],
        [1n, 3n, 0n, -8],
        [500n, 100n, 1n, 2],
        [99999n, 123456789n, 1000n, 0],
        [4200n, 25000000n, 50000n, -6],
      ];
      for (const [usd, price, conf, expo] of cases) {
        const onChain: bigint = await escrow.quoteUsdToWei(usd, price, conf, expo);
        expect(onChain, `usd=${usd} expo=${expo}`).to.equal(mirrorQuote(usd, price, conf, expo));
      }
    });

    it("rounds up on dust (ceil, never down)", async () => {
      const { escrow } = await fixture();
      const hbarWei: bigint = await escrow.quoteUsdToWei(1, 3, 0, -8);
      const num = 1n * 10n ** 26n;
      const denom = 300n;
      expect(hbarWei * denom).to.be.greaterThanOrEqual(num);
      expect((hbarWei - 1n) * denom).to.be.lessThan(num);
    });

    it("reverts on zero and negative prices", async () => {
      const { escrow } = await fixture();
      await expect(escrow.quoteUsdToWei(100, 0, 0, -8)).to.be.revertedWithCustomError(
        escrow,
        "NonPositivePrice"
      );
      await expect(escrow.quoteUsdToWei(100, -5, 0, -8)).to.be.revertedWithCustomError(
        escrow,
        "NonPositivePrice"
      );
    });

    it("reverts on wide confidence and accepts exactly 100 bps", async () => {
      const { escrow } = await fixture();
      await expect(escrow.quoteUsdToWei(100, 100_000_000, 1_010_001, -8))
        .to.be.revertedWithCustomError(escrow, "WideConfidence")
        .withArgs(101);
      expect(await escrow.quoteUsdToWei(100, 100_000_000, 1_000_000, -8)).to.be.greaterThan(0);
    });

    it("reverts on absurd exponents", async () => {
      const { escrow } = await fixture();
      await expect(escrow.quoteUsdToWei(100, 100, 0, 39)).to.be.revertedWithCustomError(
        escrow,
        "InvalidExponent"
      );
      await expect(escrow.quoteUsdToWei(100, 100, 0, -39)).to.be.revertedWithCustomError(
        escrow,
        "InvalidExponent"
      );
    });

    it("pay reverts on a stale price", async () => {
      const ctx = await fixture();
      const { escrow, mockPyth, mockHts, seller, buyer } = ctx;
      const payBy = (await latest()) + 3600;
      await escrow.connect(seller).createInvoice(2500, payBy, 600, META);
      await mockHts.setAssociated(RECEIPT, buyer.address, true);
      await mockPyth.setPrice(PRICE, CONF, EXPO, (await latest()) - 61);
      await expect(
        escrow.connect(buyer).pay(0, [], { value: 10n ** 18n })
      ).to.be.revertedWithCustomError(escrow, "StalePrice");
    });

    it("pay reverts on wide confidence and non-positive price", async () => {
      const { escrow, mockPyth, mockHts, seller, buyer } = await fixture();
      const payBy = (await latest()) + 3600;
      await escrow.connect(seller).createInvoice(2500, payBy, 60, META);
      await mockHts.setAssociated(RECEIPT, buyer.address, true);
      await mockPyth.setPrice(100_000_000, 50_000_000, -8, await latest());
      await expect(
        escrow.connect(buyer).pay(0, [], { value: 10n ** 18n })
      ).to.be.revertedWithCustomError(escrow, "WideConfidence");
      await mockPyth.setPrice(0, 0, -8, await latest());
      await expect(
        escrow.connect(buyer).pay(0, [], { value: 10n ** 18n })
      ).to.be.revertedWithCustomError(escrow, "NonPositivePrice");
    });
  });

  describe("pay happy path and fee accounting", () => {
    it("moves to PAID, holds hbarWei, mints serial, emits event", async () => {
      const { escrow, mockPyth, mockHts, seller, buyer } = await fixture();
      const fee = 10n ** 14n;
      await mockPyth.setFee(fee);
      const payBy = (await latest()) + 3600;
      await escrow.connect(seller).createInvoice(2500, payBy, 600, META);
      await mockHts.setAssociated(RECEIPT, buyer.address, true);
      await mockPyth.setPrice(PRICE, CONF, EXPO, await latest());
      const hbarWei: bigint = await escrow.quoteUsdToWei(2500, PRICE, CONF, EXPO);
      await expect(escrow.connect(buyer).pay(0, [], { value: hbarWei + fee }))
        .to.emit(escrow, "InvoicePaid")
        .withArgs(0, buyer.address, hbarWei, fee, 1);
      const inv = await escrow.invoices(0);
      expect(inv.state).to.equal(1);
      expect(inv.buyer).to.equal(buyer.address);
      expect(inv.amountHeld).to.equal(hbarWei);
      expect(inv.receiptSerial).to.equal(1);
      expect(inv.paidAt).to.be.greaterThan(0);
      expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(hbarWei);
      expect(await ethers.provider.getBalance(await mockPyth.getAddress())).to.equal(fee);
      expect(await mockHts.ownerOf(RECEIPT, 1)).to.equal(buyer.address);
    });

    it("refunds overpayment exactly (buyer net = hbarWei + fee)", async () => {
      const { escrow, mockPyth, mockHts, seller, buyer } = await fixture();
      const fee = 10n ** 14n;
      await mockPyth.setFee(fee);
      const payBy = (await latest()) + 3600;
      await escrow.connect(seller).createInvoice(2500, payBy, 600, META);
      await mockHts.setAssociated(RECEIPT, buyer.address, true);
      await mockPyth.setPrice(PRICE, CONF, EXPO, await latest());
      const hbarWei: bigint = await escrow.quoteUsdToWei(2500, PRICE, CONF, EXPO);
      const overpay = 5n * 10n ** 15n;
      const before: bigint = await ethers.provider.getBalance(buyer.address);
      const txResponse = await escrow.connect(buyer).pay(0, [], { value: hbarWei + fee + overpay });
      const mined = await txResponse.wait();
      const gas: bigint = BigInt(mined!.gasUsed) * BigInt(mined!.gasPrice ?? 0n);
      const after: bigint = await ethers.provider.getBalance(buyer.address);
      expect(before - after - gas).to.equal(hbarWei + fee);
    });

    it("reverts on underpayment", async () => {
      const { escrow, mockPyth, mockHts, seller, buyer } = await fixture();
      const fee = 10n ** 14n;
      await mockPyth.setFee(fee);
      const payBy = (await latest()) + 3600;
      await escrow.connect(seller).createInvoice(2500, payBy, 600, META);
      await mockHts.setAssociated(RECEIPT, buyer.address, true);
      await mockPyth.setPrice(PRICE, CONF, EXPO, await latest());
      const hbarWei: bigint = await escrow.quoteUsdToWei(2500, PRICE, CONF, EXPO);
      await expect(
        escrow.connect(buyer).pay(0, [], { value: hbarWei + fee - 1n })
      )
        .to.be.revertedWithCustomError(escrow, "InsufficientPayment")
        .withArgs(hbarWei + fee, hbarWei + fee - 1n);
    });

    it("reverts when the fee alone is not covered", async () => {
      const { escrow, mockPyth, mockHts, seller, buyer } = await fixture();
      await mockPyth.setFee(1000);
      const payBy = (await latest()) + 3600;
      await escrow.connect(seller).createInvoice(2500, payBy, 600, META);
      await mockHts.setAssociated(RECEIPT, buyer.address, true);
      await expect(
        escrow.connect(buyer).pay(0, [], { value: 999 })
      )
        .to.be.revertedWithCustomError(escrow, "InsufficientPayment")
        .withArgs(1000, 999);
    });
  });

  describe("pay guards", () => {
    it("seller cannot pay their own invoice", async () => {
      const { escrow, seller } = await fixture();
      await escrow.connect(seller).createInvoice(2500, (await latest()) + 3600, 600, META);
      await expect(escrow.connect(seller).pay(0, [])).to.be.revertedWithCustomError(
        escrow,
        "SellerCannotPay"
      );
    });

    it("cannot pay after the pay-by date", async () => {
      const ctx = await fixture();
      const { escrow, mockHts, seller, buyer } = ctx;
      const payBy = (await latest()) + 100;
      await escrow.connect(seller).createInvoice(2500, payBy, 600, META);
      await mockHts.setAssociated(RECEIPT, buyer.address, true);
      await increaseTime(200);
      await expect(
        escrow.connect(buyer).pay(0, [], { value: 10n ** 18n })
      ).to.be.revertedWithCustomError(escrow, "PaymentTooLate");
    });

    it("double pay reverts", async () => {
      const ctx: any = await fixture();
      const { id, hbarWei } = await createPaid(ctx);
      await expect(
        ctx.escrow.connect(ctx.buyer).pay(id, [], { value: hbarWei })
      ).to.be.revertedWithCustomError(ctx.escrow, "InvoiceNotPayable");
    });

    it("unknown invoice reverts", async () => {
      const { escrow, buyer } = await fixture();
      await expect(escrow.connect(buyer).pay(999, [])).to.be.revertedWithCustomError(
        escrow,
        "UnknownInvoice"
      );
    });
  });

  describe("settlement access control", () => {
    it("release is buyer-only", async () => {
      const ctx: any = await fixture();
      const { id } = await createPaid(ctx);
      await expect(ctx.escrow.connect(ctx.stranger).release(id)).to.be.revertedWithCustomError(
        ctx.escrow,
        "NotBuyer"
      );
      await expect(ctx.escrow.connect(ctx.seller).release(id)).to.be.revertedWithCustomError(
        ctx.escrow,
        "NotBuyer"
      );
    });

    it("release pays the seller exactly and emits InvoiceReleased", async () => {
      const ctx: any = await fixture();
      const { id, hbarWei } = await createPaid(ctx);
      const { escrow, seller, buyer } = ctx;
      const before = await ethers.provider.getBalance(seller.address);
      await expect(escrow.connect(buyer).release(id))
        .to.emit(escrow, "InvoiceReleased")
        .withArgs(id, seller.address, hbarWei);
      expect(await ethers.provider.getBalance(seller.address)).to.equal(before + hbarWei);
      expect((await escrow.invoices(id)).state).to.equal(2);
      expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(0);
    });

    it("claimAfterReview is seller-only and enforces the window", async () => {
      const ctx: any = await fixture();
      const { id, hbarWei } = await createPaid(ctx, { review: 600 });
      const { escrow, seller, buyer, stranger } = ctx;
      await expect(escrow.connect(buyer).claimAfterReview(id)).to.be.revertedWithCustomError(
        escrow,
        "NotSeller"
      );
      await expect(escrow.connect(stranger).claimAfterReview(id)).to.be.revertedWithCustomError(
        escrow,
        "NotSeller"
      );
      await expect(escrow.connect(seller).claimAfterReview(id)).to.be.revertedWithCustomError(
        escrow,
        "ReviewWindowActive"
      );
      await increaseTime(601);
      await expect(escrow.connect(seller).claimAfterReview(id))
        .to.emit(escrow, "InvoiceReleased")
        .withArgs(id, seller.address, hbarWei);
    });

    it("refund is seller-only and pays the buyer", async () => {
      const ctx: any = await fixture();
      const { id, hbarWei } = await createPaid(ctx);
      const { escrow, seller, buyer } = ctx;
      await expect(escrow.connect(buyer).refund(id)).to.be.revertedWithCustomError(
        escrow,
        "NotSeller"
      );
      const before = await ethers.provider.getBalance(buyer.address);
      await expect(escrow.connect(seller).refund(id))
        .to.emit(escrow, "InvoiceRefunded")
        .withArgs(id, buyer.address, hbarWei);
      expect(await ethers.provider.getBalance(buyer.address)).to.be.greaterThan(before);
      expect((await escrow.invoices(id)).state).to.equal(3);
    });

    it("claimRefundIfExpired needs the pay-by date to pass, then pays the buyer", async () => {
      const ctx: any = await fixture();
      const { escrow, mockPyth, mockHts, seller, buyer } = ctx;
      const payBy = (await latest()) + 200;
      await escrow.connect(seller).createInvoice(2500, payBy, 600, META);
      await mockHts.setAssociated(RECEIPT, buyer.address, true);
      await mockPyth.setPrice(PRICE, CONF, EXPO, await latest());
      const hbarWei: bigint = await escrow.quoteUsdToWei(2500, PRICE, CONF, EXPO);
      await escrow.connect(buyer).pay(0, [], { value: hbarWei });
      await expect(
        escrow.connect(buyer).claimRefundIfExpired(0)
      ).to.be.revertedWithCustomError(escrow, "RefundNotAvailable");
      await expect(
        escrow.connect(seller).claimRefundIfExpired(0)
      ).to.be.revertedWithCustomError(escrow, "NotBuyer");
      await increaseTime(300);
      await expect(escrow.connect(buyer).claimRefundIfExpired(0))
        .to.emit(escrow, "InvoiceRefunded")
        .withArgs(0, buyer.address, hbarWei);
    });
  });

  describe("state machine", () => {
    it("settle functions revert unless PAID", async () => {
      const { escrow, seller, buyer } = await fixture();
      await escrow.connect(seller).createInvoice(2500, (await latest()) + 3600, 600, META);
      await expect(escrow.connect(buyer).release(0)).to.be.revertedWithCustomError(
        escrow,
        "InvoiceNotPaid"
      );
      await expect(escrow.connect(seller).refund(0)).to.be.revertedWithCustomError(
        escrow,
        "InvoiceNotPaid"
      );
      await expect(escrow.connect(seller).claimAfterReview(0)).to.be.revertedWithCustomError(
        escrow,
        "InvoiceNotPaid"
      );
      await expect(
        escrow.connect(buyer).claimRefundIfExpired(0)
      ).to.be.revertedWithCustomError(escrow, "InvoiceNotPaid");
    });

    it("terminal states reject every further transition", async () => {
      const ctx: any = await fixture();
      const { id } = await createPaid(ctx);
      const { escrow, seller, buyer } = ctx;
      await escrow.connect(buyer).release(id);
      await expect(escrow.connect(buyer).release(id)).to.be.revertedWithCustomError(
        escrow,
        "InvoiceNotPaid"
      );
      await expect(escrow.connect(seller).refund(id)).to.be.revertedWithCustomError(
        escrow,
        "InvoiceNotPaid"
      );
      await expect(escrow.connect(seller).claimAfterReview(id)).to.be.revertedWithCustomError(
        escrow,
        "InvoiceNotPaid"
      );
      await expect(
        escrow.connect(buyer).claimRefundIfExpired(id)
      ).to.be.revertedWithCustomError(escrow, "InvoiceNotPaid");
      await expect(
        escrow.connect(buyer).pay(id, [], { value: 1 })
      ).to.be.revertedWithCustomError(escrow, "InvoiceNotPayable");
      await expect(escrow.expire(id)).to.be.revertedWithCustomError(escrow, "InvoiceNotPayable");
    });

    it("expire works for anyone after pay-by, emits InvoiceExpired", async () => {
      const { escrow, seller, stranger } = await fixture();
      await escrow.connect(seller).createInvoice(2500, (await latest()) + 100, 600, META);
      await expect(escrow.connect(stranger).expire(0)).to.be.revertedWithCustomError(
        escrow,
        "TooEarlyToExpire"
      );
      await increaseTime(200);
      await expect(escrow.connect(stranger).expire(0))
        .to.emit(escrow, "InvoiceExpired")
        .withArgs(0);
      expect((await escrow.invoices(0)).state).to.equal(4);
    });

    it("expired invoices cannot be paid", async () => {
      const { escrow, seller, buyer } = await fixture();
      await escrow.connect(seller).createInvoice(2500, (await latest()) + 100, 600, META);
      await increaseTime(200);
      await escrow.expire(0);
      await expect(
        escrow.connect(buyer).pay(0, [], { value: 10n ** 18n })
      ).to.be.revertedWithCustomError(escrow, "InvoiceNotPayable");
    });
  });

  describe("HTS failures", () => {
    it("unassociated buyer reverts the whole payment", async () => {
      const { escrow, mockPyth, seller, buyer } = await fixture();
      await escrow.connect(seller).createInvoice(2500, (await latest()) + 3600, 600, META);
      await mockPyth.setPrice(PRICE, CONF, EXPO, await latest());
      const hbarWei: bigint = await escrow.quoteUsdToWei(2500, PRICE, CONF, EXPO);
      await expect(escrow.connect(buyer).pay(0, [], { value: hbarWei }))
        .to.be.revertedWithCustomError(escrow, "ReceiptTransferFailed")
        .withArgs(2001);
      expect((await escrow.invoices(0)).state).to.equal(0);
    });

    it("non-success mint code reverts", async () => {
      const { escrow, mockPyth, mockHts, seller, buyer } = await fixture();
      await escrow.connect(seller).createInvoice(2500, (await latest()) + 3600, 600, META);
      await mockHts.setAssociated(RECEIPT, buyer.address, true);
      await mockHts.setMintCode(150);
      await mockPyth.setPrice(PRICE, CONF, EXPO, await latest());
      const hbarWei: bigint = await escrow.quoteUsdToWei(2500, PRICE, CONF, EXPO);
      await expect(escrow.connect(buyer).pay(0, [], { value: hbarWei }))
        .to.be.revertedWithCustomError(escrow, "MintFailed")
        .withArgs(150);
    });

    it("non-success transfer code reverts even when associated", async () => {
      const { escrow, mockPyth, mockHts, seller, buyer } = await fixture();
      await escrow.connect(seller).createInvoice(2500, (await latest()) + 3600, 600, META);
      await mockHts.setAssociated(RECEIPT, buyer.address, true);
      await mockHts.setTransferCode(9);
      await mockPyth.setPrice(PRICE, CONF, EXPO, await latest());
      const hbarWei: bigint = await escrow.quoteUsdToWei(2500, PRICE, CONF, EXPO);
      await expect(escrow.connect(buyer).pay(0, [], { value: hbarWei }))
        .to.be.revertedWithCustomError(escrow, "ReceiptTransferFailed")
        .withArgs(9);
    });
  });

  describe("reentrancy", () => {
    async function attackerFixture() {
      const base = await fixture();
      const attacker: any = await ethers.deployContract("ReentrancyAttacker", [
        await base.escrow.getAddress(),
      ]);
      return { ...base, attacker };
    }

    it("release reentry holds funds, emits PayoutFailed, allows retry", async () => {
      const { escrow, mockPyth, mockHts, buyer, attacker } = await attackerFixture();
      const payBy = (await latest()) + 3600;
      await attacker.create(2500, payBy, 600, META);
      const id = 0;
      await mockHts.setAssociated(RECEIPT, buyer.address, true);
      await mockHts.setAssociated(RECEIPT, await attacker.getAddress(), true);
      await mockPyth.setPrice(PRICE, CONF, EXPO, await latest());
      const hbarWei: bigint = await escrow.quoteUsdToWei(2500, PRICE, CONF, EXPO);
      await escrow.connect(buyer).pay(id, [], { value: hbarWei });
      await attacker.setMode(1);
      await expect(escrow.connect(buyer).release(id))
        .to.emit(escrow, "PayoutFailed")
        .withArgs(id, await attacker.getAddress(), hbarWei);
      const inv = await escrow.invoices(id);
      expect(inv.state).to.equal(1);
      expect(inv.amountHeld).to.equal(hbarWei);
      await attacker.setMode(0);
      await expect(escrow.connect(buyer).release(id))
        .to.emit(escrow, "InvoiceReleased")
        .withArgs(id, await attacker.getAddress(), hbarWei);
      expect((await escrow.invoices(id)).state).to.equal(2);
    });

    it("refund reentry holds funds, emits PayoutFailed, allows retry", async () => {
      const { escrow, mockPyth, mockHts, seller, attacker } = await attackerFixture();
      const payBy = (await latest()) + 3600;
      await escrow.connect(seller).createInvoice(2500, payBy, 600, META);
      const id = 0;
      await attacker.setInvoiceId(id);
      await mockHts.setAssociated(RECEIPT, await attacker.getAddress(), true);
      await mockPyth.setPrice(PRICE, CONF, EXPO, await latest());
      const hbarWei: bigint = await escrow.quoteUsdToWei(2500, PRICE, CONF, EXPO);
      await attacker.attackPay([], { value: hbarWei });
      await attacker.setMode(2);
      await expect(escrow.connect(seller).refund(id))
        .to.emit(escrow, "PayoutFailed")
        .withArgs(id, await attacker.getAddress(), hbarWei);
      const inv = await escrow.invoices(id);
      expect(inv.state).to.equal(1);
      expect(inv.amountHeld).to.equal(hbarWei);
      await attacker.setMode(0);
      await expect(escrow.connect(seller).refund(id))
        .to.emit(escrow, "InvoiceRefunded")
        .withArgs(id, await attacker.getAddress(), hbarWei);
      expect((await escrow.invoices(id)).state).to.equal(3);
    });

    it("pay reentry via excess refund reverts the whole payment", async () => {
      const { escrow, mockPyth, mockHts, seller, attacker } = await attackerFixture();
      const payBy = (await latest()) + 3600;
      await escrow.connect(seller).createInvoice(2500, payBy, 600, META);
      await attacker.setInvoiceId(0);
      await mockHts.setAssociated(RECEIPT, await attacker.getAddress(), true);
      await mockPyth.setPrice(PRICE, CONF, EXPO, await latest());
      const hbarWei: bigint = await escrow.quoteUsdToWei(2500, PRICE, CONF, EXPO);
      await expect(
        attacker.attackPay([], { value: hbarWei + 100n })
      ).to.be.revertedWithCustomError(escrow, "ExcessRefundFailed");
      const inv = await escrow.invoices(0);
      expect(inv.state).to.equal(0);
      expect(inv.amountHeld).to.equal(0);
    });
  });

  describe("view helpers", () => {
    it("quoteCurrent matches quoteUsdToWei plus the mock fee", async () => {
      const { escrow, mockPyth } = await fixture();
      await mockPyth.setFee(7);
      await mockPyth.setPrice(PRICE, CONF, EXPO, await latest());
      const [hbarWei, fee] = await escrow.quoteCurrent(2500);
      expect(hbarWei).to.equal(await escrow.quoteUsdToWei(2500, PRICE, CONF, EXPO));
      expect(fee).to.equal(7);
    });

    it("amountHeldTinybar converts at 1e10 wei per tinybar", async () => {
      const ctx: any = await fixture();
      const { id, hbarWei } = await createPaid(ctx);
      expect(await ctx.escrow.amountHeldTinybar(id)).to.equal(hbarWei / 10n ** 10n);
    });
  });
});
