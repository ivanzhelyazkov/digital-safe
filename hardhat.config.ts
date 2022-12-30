import "@typechain/hardhat";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-web3";
import "@nomiclabs/hardhat-etherscan"
import "hardhat-contract-sizer";
import "hardhat-deploy";
import "hardhat-deploy-ethers"
import "hardhat-gas-reporter";
import 'solidity-coverage';
import "@nomicfoundation/hardhat-chai-matchers";
import * as tenderly from "@tenderly/hardhat-tenderly";
import { HardhatUserConfig } from "hardhat/config";
import dotenv from 'dotenv';

dotenv.config();

tenderly.setup();

interface EnvOptions {
  ETHEREUM_PROVIDER_URL?: string;
  ETHEREUM_GOERLI_PROVIDER_URL?: string;
  ETHERSCAN_API_KEY?: string;
  TENDERLY_FORK_ID?: string;
  TENDERLY_PROJECT?: string;
  TENDERLY_USERNAME?: string;
  TENDERLY_DEPLOYER_ADDRESS?: string;
}

const {
  ETHEREUM_PROVIDER_URL = '',
  ETHEREUM_GOERLI_PROVIDER_URL = '',
  ETHERSCAN_API_KEY,
  TENDERLY_FORK_ID = '',
  TENDERLY_PROJECT = '',
  TENDERLY_USERNAME = '',
  TENDERLY_DEPLOYER_ADDRESS = ''
}: EnvOptions = process.env as any as EnvOptions;

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      forking: {
        url: ETHEREUM_PROVIDER_URL,
        enabled: false,
        blockNumber: 16296300
      }
    },
    mainnet: {
      gasPrice: 50 * 10 ** 9, // 50 gwei
      url: ETHEREUM_PROVIDER_URL,
      timeout: 200000,
    },
    goerli: {
      url: ETHEREUM_GOERLI_PROVIDER_URL,
      timeout: 200000
    },
    tenderly: {
      chainId: 1,
      url: `https://rpc.tenderly.co/fork/${TENDERLY_FORK_ID}`,
      autoImpersonate: true,
      saveDeployments: true,
      live: true
    }
  },
  tenderly: {
      forkNetwork: '1',
      project: TENDERLY_PROJECT,
      username: TENDERLY_USERNAME
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test"
  },
  solidity: {
    version: "0.8.16",
    settings: {
      metadata: {
        // Not including the metadata hash
        // https://github.com/paulrberg/solidity-template/issues/31
        bytecodeHash: "none",
      },
      optimizer: {
        enabled: true,
        runs: 7777,
      },
    },
  },
  namedAccounts: {
    deployer: {
      tenderly: TENDERLY_DEPLOYER_ADDRESS
    }
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: false,
  },
  gasReporter: {
    enabled: true,
    excludeContracts: ['test/', 'ERC20.sol']
  },
  typechain: {
    outDir: "typechain",
    target: "ethers-v5"
  }
};

export default config;