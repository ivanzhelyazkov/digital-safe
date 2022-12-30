import hre from "hardhat";
import { ethers, network } from "hardhat";
import { BigNumber, BytesLike, Contract, ContractInterface, ContractReceipt, ContractTransaction } from "ethers";
import { ERC20, IERC20 } from "../typechain";
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';


/**
 * Deploy a contract by name without constructor arguments
 */
async function deploy(contractName: string) {
    let Contract = await ethers.getContractFactory(contractName);
    return await Contract.deploy({gasLimit: 8888888});
}

/**
 * Deploy a contract by name with constructor arguments
 */
async function deployArgs(contractName: string, ...args: any[]) {
    let Contract = await ethers.getContractFactory(contractName);
    return await Contract.deploy(...args, {gasLimit: 8888888});
}

/**
 * Deploy a contract with abi
 */
 async function deployWithAbi(contract: { abi: ContractInterface; bytecode: BytesLike }, 
        deployer: SignerWithAddress,
        ...args: any[]) {
    let Factory = new ethers.ContractFactory(contract.abi, contract.bytecode, deployer);
    return await Factory.deploy(...args, {gasLimit: 8888888});
}

/**
 * Deploy a contract by name without constructor arguments
 * Link contract to a library address
 */
 async function deployAndLink(contractName: string, libraryName: string, libraryAddress: string) {
    const params = {
        libraries: {
            [libraryName]: libraryAddress
        }
    }
    let Contract = await ethers.getContractFactory(contractName, params);
    return await Contract.deploy({gasLimit: 8888888});
}

/**
 * Set an address ETH balance to 10
 * @param {*} address 
 */
 async function setBalance(address: any) {
    await network.provider.send("hardhat_setBalance", [
      address,
      bnDecimal(10).toHexString(),
    ]);
}

/**
 * Receive 50k wETH from Avalanche bridge address
 * To be used on mainnet forks
 * @param receiverAccount 
 */
async function receiveWeth(receiverAccount: SignerWithAddress) {
    let wethAddress = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
    let accountWithWeth = '0x8EB8a3b98659Cce290402893d0123abb75E3ab28'
    await receiveToken(receiverAccount, accountWithWeth, wethAddress, bnDecimal(50000));
}

/**
 * Receive 1M DAI from Avalanche bridge
 * To be used on mainnet forks
 * @param receiverAccount 
 */
async function receiveDAI(receiverAccount: SignerWithAddress) {
    let daiAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
    let accountWithDAI = '0x8EB8a3b98659Cce290402893d0123abb75E3ab28'
    await receiveToken(receiverAccount, accountWithDAI, daiAddress, bnDecimals(1000000, 18));
}

/**
 * Receive 1M USDT from OKEx official exchange address
 * To be used on mainnet forks
 * @param receiverAccount 
 */
async function receiveUSDT(receiverAccount: SignerWithAddress) {
    let usdtAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
    let accountWithUSDT = '0x5041ed759Dd4aFc3a72b8192C143F72f4724081A'
    await receiveToken(receiverAccount, accountWithUSDT, usdtAddress, bnDecimals(1000000, 6));
}

/**
 * Receive 1M USDC from Circle address
 * To be used on mainnet forks
 * @param receiverAccount 
 */
async function receiveUSDC(receiverAccount: SignerWithAddress) {
    let usdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
    let accountWithUSDC = '0x55fe002aeff02f77364de339a1292923a15844b8'
    await receiveToken(receiverAccount, accountWithUSDC, usdcAddress, bnDecimals(1000000, 6));
}

/**
 * Get mainnet tokens as ERC20 contracts
 * @returns 
 */
async function getTokens() {
    let usdtAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
    let usdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
    let wethAddress = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
    let daiAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
    let usdt: ERC20 = <ERC20>await ethers.getContractAt('ERC20', usdtAddress)
    let usdc: ERC20 = <ERC20>await ethers.getContractAt('ERC20', usdcAddress)
    let dai: ERC20 = <ERC20>await ethers.getContractAt('ERC20', daiAddress)
    let weth: ERC20 = <ERC20>await ethers.getContractAt('ERC20', wethAddress)
    return {
        usdt: usdt,
        usdc: usdc,
        dai: dai,
        weth: weth
    }
}

/**
 * Receive a token using an impersonated account
 * @param {hre.ethers.signer} receiverAccount - Signer of account to receive tokens
 * @param {String} accountToImpersonate - address
 * @param {String} token - token address
 * @param {String} amount - amount to send
 */
async function receiveToken(receiverAccount: SignerWithAddress, accountToImpersonate: string, tokenAddress: string, amount: BigNumber) {
    // Impersonate account
    // await hre.network.provider.request({
    //     method: "hardhat_impersonateAccount",
    //     params: [accountToImpersonate]}
    // )
    const signer = await ethers.getSigner(accountToImpersonate)
    // Send tokens to account
    let ethSendTx = {
        to: accountToImpersonate,
        value: bnDecimal(6)
    }
    await receiverAccount.sendTransaction(ethSendTx);
    const token = await ethers.getContractAt('IERC20', tokenAddress);
    await token.connect(signer).transfer(receiverAccount.address, amount, {gasLimit: 50000});
}

/**
 * Receive tokens using an impersonated account
 * @param {hre.ethers.signer} receiverAccount - Signer of account to receive tokens
 * @param {String} accountToImpersonate - address
 * @param {Map} tokens - map of token address to amount to receive of that token
 */
async function receiveTokens(receiverAccount: SignerWithAddress, accountToImpersonate: string, tokens: Map<any, any>) {
    // Impersonate account
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [accountToImpersonate]}
    )
    const signer = await ethers.getSigner(accountToImpersonate)
    // Send tokens to account
    let ethSendTx = {
        to: accountToImpersonate,
        value: bnDecimal(1)
    }
    // console.log('sending eth to account:', accountToImpersonate)
    await receiverAccount.sendTransaction(ethSendTx);
    for(let [address, amount] of Object.entries(tokens)) {
        const token = await ethers.getContractAt('IERC20', address);
        await token.connect(signer).transfer(receiverAccount.address, amount)
    }
}

async function impersonate(address: string) {
    await setBalance(address);
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [address]}
    )
    return await ethers.getSigner(address)
}

/**
 * Get event details from a transaction
 */
async function getEvent(tx: ContractTransaction, eventName: string) {
  let receipt = <ContractReceipt>await tx.wait();
  let event = receipt.events? receipt.events.filter(e => e.event == eventName) : null;
  return event;
}

/**
 * Get ETH Balance of contract
 * @param {ethers.Contract} contract 
 */
async function getBalance(contract: Contract) {
    return await contract.provider.getBalance(contract.address);
}

/**
 * Get latest block timestamp
 * @returns current block timestamp
 */
async function getBlockTimestamp() {
    const latestBlock = await network.provider.send("eth_getBlockByNumber", ["latest", false]);
    return hre.web3.utils.hexToNumber(latestBlock.timestamp);
}

/**
 * Get tx timestamp
 * @returns tx timestamp
 */
async function getTxTimestamp(tx: ContractTransaction) {
    let receipt = await tx.wait();
    let blockNumber = receipt.blockNumber;
    let block = await ethers.provider.getBlock(blockNumber);
    let timestamp = block.timestamp;
    return timestamp;
}

/**
 * Increase time in Hardhat Network
 */
async function increaseTime(time: string) {
    await network.provider.send("evm_increaseTime", [parseInt(time, 10)]);
    await network.provider.send("evm_mine");
}

/**
 * Decrease time in Hardhat Network
 */
async function decreaseTime(seconds: string) {
    await network.provider.send("evm_increaseTime", [-seconds]);
    await network.provider.send("evm_mine");
}

/**
 * Mine several blocks in network
 * @param {Number} blockCount how many blocks to mine
 */
async function mineBlocks(blockCount: number) {
    for(let i = 0 ; i < blockCount ; ++i) {
        await network.provider.send("evm_mine");
    }
}

/**
 * Activate or disactivate automine in hardhat network
 * @param {Boolean} active 
 */
async function setAutomine(active: Boolean) {
    await network.provider.send("evm_setAutomine", [active]);
}

async function getLastBlock() {
    return await network.provider.send("eth_getBlockByNumber", ["latest", false]);
}

async function getLastBlockTimestamp() {
    let block = await getLastBlock();
    return block.timestamp;
}

/**
 * Change current fork for hardhat network
 * @param network 
 * @returns 
 */
 async function resetFork(_network: string) {
    let url;
    const env = process.env;
    const key = env.ALCHEMY_KEY;
    const alchemy = {
        mainnet: 'https://eth-mainnet.alchemyapi.io/v2/',
        arbitrum: 'https://arb-mainnet.g.alchemy.com/v2/',
        optimism: 'https://opt-mainnet.g.alchemy.com/v2/',
        polygon: 'https://polygon-mainnet.g.alchemy.com/v2/',
        kovan: 'https://eth-kovan.alchemyapi.io/v2/'
    }
    switch(_network) {
        case 'mainnet':
            url = alchemy['mainnet'] + key;
            break;
        case 'arbitrum':
            url = alchemy['arbitrum'] + key;
            break;
        case 'optimism':
            url = alchemy['optimism'] + key;
            break;
        case 'polygon':
            url = alchemy['polygon'] + key;
            break;
        default:
            console.log('invalid network');
            return;
    }
    await network.provider.request({
        method: "hardhat_reset",
        params: [
          {
            forking: {
              jsonRpcUrl: url
            }
          }
        ]
      });
}

async function verifyContractNoArgs(address: string) {
    try {
        await hre.run("verify:verify", {
            address: address,
            constructorArguments: [],
        });
    } catch (err) {
        console.log('error while verifying contract:', err);
    }
}

async function verifyContractWithArgs(address: string, ...args: any[]) {
    try {
        await hre.run("verify:verify", {
            address: address,
            constructorArguments: [...args],
        });
    } catch (err) {
        console.log('error while verifying contract:', err);
    }
}

async function verifyContractWithArgsAndName(address: string, contractName: string, ...args: any[]) {
    try {
        await hre.run("verify:verify", {
            address: address,
            contract: contractName,
            constructorArguments: [...args],
        });
    } catch (err) {
        console.log('error while verifying contract:', err);
    }
}

/**
 * Return BigNumber
 */
function bn(amount: string | number) {
    return ethers.BigNumber.from(amount);
}

/**
 * Returns bignumber scaled to 18 decimals
 */
function bnDecimal(amount: string | number) {
    let decimal = Math.pow(10, 18);
    let decimals = bn(decimal.toString());
    return bn(amount).mul(decimals);
}

/**
 * Returns bignumber scaled to custom amount of decimals
 */
 function bnDecimals(amount: string | number, _decimals: number) {
    let decimal = Math.pow(10, _decimals);
    let decimals = bn(decimal.toString());
    return bn(amount).mul(decimals);
}

/**
 * Returns number representing BigNumber without decimal precision
 */
function getNumberNoDecimals(amount: BigNumber) {
    let decimal = Math.pow(10, 18);
    let decimals = bn(decimal.toString());
    return amount.div(decimals).toNumber();
}

/**
 * Returns number representing BigNumber without decimal precision (custom)
 */
 function getNumberDivDecimals(amount: BigNumber, _decimals: number) {
    let decimal = Math.pow(10, _decimals);
    let decimals = bn(decimal.toString());
    return amount.div(decimals).toNumber();
}

export {
    deploy, deployArgs, deployWithAbi, deployAndLink,
    bn, bnDecimal, bnDecimals, getNumberNoDecimals, getNumberDivDecimals, 
    getBlockTimestamp, getTxTimestamp, increaseTime, mineBlocks, getBalance, setAutomine, 
    getLastBlock, getLastBlockTimestamp, decreaseTime, getEvent, setBalance,
    // mainnet fork functions
    impersonate,receiveWeth, receiveUSDC, receiveUSDT, receiveDAI, resetFork, getTokens,
    verifyContractNoArgs, verifyContractWithArgs, verifyContractWithArgsAndName,
}