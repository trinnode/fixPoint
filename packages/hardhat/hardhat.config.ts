import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import * as dotenv from "dotenv";

dotenv.config({ path: __dirname + "/.env" });

function operatorAccounts(): string[] {
  const key = (process.env.HEDERA_OPERATOR_KEY ?? "").trim();
  if (!key) return [];
  return [key.startsWith("0x") ? key : `0x${key}`];
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {},
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    hederaTestnet: {
      url: "https://testnet.hashio.io/api/v1",
      chainId: 296,
      accounts: operatorAccounts(),
    },
  },
};

export default config;
