import { ethers, deployments } from 'hardhat';
import { bnDecimals, deploy, deployArgs } from '../scripts/helpers';
import { DigitalSafe, ERC20 } from '../typechain';

/**
 * Test fixture which deploys 7 different tokens with various decimals
 * Sends tokens to the first 10 network addresses
 * Approves tokens from the addresses to the safe
 * Deploys DigitalSafe contract
 */
export const testFixture = deployments.createFixture(async () => {
    const safe = <DigitalSafe>await deploy('DigitalSafe');
    const tokens: ERC20[] = Array(0);
    let token = <ERC20>await deployArgs('MockERC20', 'Test', 'Test', 0);
    tokens.push(token);
    token = <ERC20>await deployArgs('MockERC20', 'Test', 'Test', 6);
    tokens.push(token);
    token = <ERC20>await deployArgs('MockERC20', 'Test', 'Test', 8);
    tokens.push(token);
    token = <ERC20>await deployArgs('MockERC20', 'Test', 'Test', 11);
    tokens.push(token);
    token = <ERC20>await deployArgs('MockERC20', 'Test', 'Test', 12);
    tokens.push(token);
    token = <ERC20>await deployArgs('MockERC20', 'Test', 'Test', 14);
    tokens.push(token);
    token = <ERC20>await deployArgs('MockERC20', 'Test', 'Test', 18);
    tokens.push(token);

    let users = await ethers.getSigners();
    // Transfer tokens to users
    for(let i = 0 ; i < tokens.length ; ++i) {
        for(let j = 0 ; j < 10 ; ++j) {
            tokens[i].transfer(users[j].address, bnDecimals(1000000, await tokens[i].decimals()))
        }
    }
    // Approve tokens to digital safe
    for(let i = 0 ; i < tokens.length ; ++i) {
        for(let j = 0 ; j < 10 ; ++j) {
            tokens[i].connect(users[j]).approve(safe.address, bnDecimals(1000000, await tokens[i].decimals()))
        }
    }
    
    return {
        safe, tokens, users
    }
})