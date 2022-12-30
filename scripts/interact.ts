
import { ethers, getNamedAccounts } from 'hardhat';
import { DigitalSafe, ERC20 } from '../typechain';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { bnDecimal, increaseTime, receiveDAI, getTokens } from './helpers';

import digitalSafe from '../deployments/tenderly/DigitalSafe.json';

/**
 * Script to interact with forked tenderly deployment
 * Make sure to run npm run deploy:tenderly first
 */
async function interactFork() {
    let safeAddress = digitalSafe.address;
    let { deployer } = await getNamedAccounts(); 
    let owner: SignerWithAddress | undefined;
    if(!deployer) {
        console.log('Please set tenderly deployer address to be able to collect fees from the fork');
    } else {
        owner = await ethers.getSigner(deployer);
    }
    let safe: DigitalSafe = <DigitalSafe>await ethers.getContractAt('DigitalSafe', safeAddress);
    let users = await ethers.getSigners();    

    let ethAddress = await safe.ethAddress();
    console.log('eth address:', ethAddress)
    // deposit ETH
    let ethDepositAmount = bnDecimal(1);
    await safe.connect(users[0]).deposit(ethAddress, ethDepositAmount, {value: ethDepositAmount, gasLimit: 100000});
    console.log('deposited 1 eth from:', users[0].address);

    // deposit DAI
    let tokens = await getTokens();
    await receiveDAI(users[1]);
    await tokens.dai.connect(users[1]).approve(safe.address, bnDecimal(1000), {gasLimit: 100000});
    await safe.connect(users[1]).deposit(tokens.dai.address, bnDecimal(1000), {gasLimit: 120000});

    // increase time by 24 hours
    await increaseTime('86400');

    let withdrawAmount = ethDepositAmount.div(2);
    // withdraw
    // tenderly fork doesn't estimate gas limit properly, so set a custom gas limit
    await safe.connect(users[0]).withdraw(ethAddress, withdrawAmount, {gasLimit: 100000});
    console.log('withdrawn 0.5 ETH for', users[0].address);
    let daiWithdrawAmount = bnDecimal(777);
    await safe.connect(users[1]).withdraw(tokens.dai.address, daiWithdrawAmount, {gasLimit: 100000});
    console.log('withdrawn 777 DAI for:', users[1].address)

    // collect fees
    if(owner) {
        await safe.connect(owner).collectFees(ethAddress, owner.address, {gasLimit: 100000});
        console.log('successfully collected fees');
    }
}

interactFork().catch(console.log)