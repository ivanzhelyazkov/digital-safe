import { expect } from 'chai';
import { DigitalSafe, ERC20, TestRevertReceive, TestWithdrawReentrancy } from '../typechain';
import { bn, bnDecimal, bnDecimals, getTxTimestamp, increaseTime, getBalance, deployArgs } from '../scripts/helpers';
import { testFixture } from './fixture';
import { BigNumber } from 'ethers';


describe('DigitalSafe', () => {
    let safe: DigitalSafe;
    let ethAddress: string;
    let feePerSecond: BigNumber;
    let tokens: ERC20[];
    let users: any[];
    let testRevertReceive: TestRevertReceive;
    let testReentrancy: TestWithdrawReentrancy;

    beforeEach(async () => {
        ({ safe, tokens, users } = await testFixture());
        ethAddress = await safe.ethAddress();
        feePerSecond = await safe.feePerSecond();
        testRevertReceive = <TestRevertReceive>await deployArgs('TestRevertReceive', safe.address);
        testReentrancy = <TestWithdrawReentrancy>await deployArgs('TestWithdrawReentrancy', safe.address);
    });

    describe('Withdraw', () => {
        it(`should revert on withdraw if withdrawAmount is 0`, async () => {
            await expect(safe.withdraw(ethAddress, 0)).
                to.be.revertedWithCustomError(safe, 'InvalidWithdrawAmount');
        });

        it(`should revert on withdraw if not deposited`, async () => {
            await expect(safe.withdraw(ethAddress, 1)).
                to.be.revertedWithCustomError(safe, 'InvalidWithdrawal');
        });

        it(`should revert if withdrawing more than deposited`, async () => {
            let depositAmount = bnDecimal(2);
            await safe.deposit(ethAddress, depositAmount, {value: depositAmount});
            await expect(safe.withdraw(ethAddress, depositAmount.add(1))).
                to.be.revertedWithCustomError(safe, 'InvalidWithdrawal');
        });

        it(`should revert on fail to transfer ETH fees to address`, async () => {
            let depositAmount = bnDecimal(3);
            await testRevertReceive.deposit(ethAddress, depositAmount, {value: depositAmount});
            await expect(testRevertReceive.withdraw(ethAddress, 1)).
                to.be.revertedWithCustomError(safe, 'ETHTransferFailed');
        });

        it(`shouldn't be able to reenter withdraw`, async () => {
            let depositAmount = bnDecimal(2);
            await testReentrancy.deposit(ethAddress, depositAmount, {value: depositAmount});
            await expect(testReentrancy.withdraw(ethAddress, depositAmount.div(2))).
                to.be.reverted;
        });

        it(`should be able to withdraw maximum of deposited amount sub the accumulated fee for deposit duration`, async () => {
            let depositAmount = bnDecimal(2);
            await safe.deposit(ethAddress, depositAmount, {value: depositAmount});

            // increase time by 24 hours
            let duration = '86400';
            await increaseTime(duration);
            // check accumulated fee for that time
            // each next block timestamp gets incremented by 1 in hardhat network, so use duration + 1
            let accumulatedFee = depositAmount.mul(Number(duration) + 1).mul(feePerSecond).div(bn(10).pow(18));
            // check we're not able to withdraw more than accumulated fee
            await expect(safe.withdraw(ethAddress, depositAmount.sub(accumulatedFee).add(1))).
                to.be.revertedWithCustomError(safe, 'InvalidWithdrawal');

            // each next block timestamp gets incremented by 1 in hardhat network, so use duration + 2
            accumulatedFee = depositAmount.mul(Number(duration) + 2).mul(feePerSecond).div(bn(10).pow(18));
            // check we're able to withdraw
            await expect(safe.withdraw(ethAddress, depositAmount.sub(accumulatedFee).sub(10))).
                not.to.be.revertedWithCustomError(safe, 'InvalidWithdrawal');
        });

        it(`should emit Withdraw event on successful withdrawal`, async () => {
            let depositAmount = bnDecimal(2);
            await safe.deposit(ethAddress, depositAmount, {value: depositAmount});
            await expect(safe.withdraw(ethAddress, 1)).to.emit(safe, 'Withdrawal');
        });

        it(`user should receive withdrawAmount ETH on withdrawal for ETH`, async () => {
            let depositAmount = bnDecimal(2);
            await safe.deposit(ethAddress, depositAmount, {value: depositAmount});
            let withdrawAmount = bnDecimal(1);
            let balanceBefore = await getBalance(users[0]);
            let tx = await safe.withdraw(ethAddress, withdrawAmount);
            let receipt = await tx.wait();
            let gasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice);
            let balanceAfter = await getBalance(users[0]);
            // account for gas cost of tx
            expect(balanceAfter.sub(balanceBefore)).to.be.eq(withdrawAmount.sub(gasCost));
        });

        it(`user should receive withdrawAmount of ERC-20 token on withdrawal for any ERC-20 token`, async () => {
            for(let i = 0 ; i < tokens.length ; ++i) {
                let decimals = await tokens[i].decimals();
                let depositAmount = bnDecimals(2000, decimals);
                await safe.deposit(tokens[i].address, depositAmount);

                let withdrawAmount = bnDecimals(1000, decimals);
                let balanceBefore = await tokens[i].balanceOf(users[0].address);
                await safe.withdraw(tokens[i].address, withdrawAmount);
                let balanceAfter = await tokens[i].balanceOf(users[0].address);
                expect(balanceAfter.sub(balanceBefore)).to.be.eq(withdrawAmount);
            }
        });

        it(`should update stored deposit struct for user on withdrawal for ETH`, async () => {
            let depositAmount = bnDecimal(3);
            let tx = await safe.connect(users[0]).deposit(ethAddress, depositAmount, {value: depositAmount});
            let lastUpdateTimestamp = await getTxTimestamp(tx);
            let depositForUser = await safe.userDeposit(users[0].address, ethAddress);
            expect(depositForUser.amount).to.be.eq(depositAmount);
            expect(depositForUser.fee).to.be.eq(0);
            expect(depositForUser.timestamp).to.be.eq(lastUpdateTimestamp);

            // increase time
            await increaseTime('100');
            
            // make withdrawal
            let withdrawAmount = bnDecimal(1);
            tx = await safe.connect(users[0]).withdraw(ethAddress, withdrawAmount);
            let timestamp = await getTxTimestamp(tx);
            let timeElapsed = timestamp - lastUpdateTimestamp;
            // fee should be incremented according to time elapsed
            let accumulatedFee = depositForUser.amount.mul(timeElapsed).mul(feePerSecond).div(bn(10).pow(18));
            let expectedFee = depositForUser.fee.add(accumulatedFee);
            // amount should be decremented with the newly deposited amount and subtracted with the fee
            let expectedAmount = depositForUser.amount.sub(withdrawAmount).sub(accumulatedFee);
            depositForUser = await safe.userDeposit(users[0].address, ethAddress);
            expect(depositForUser.amount).to.be.eq(expectedAmount);
            expect(depositForUser.fee).to.be.eq(expectedFee);
            expect(depositForUser.timestamp).to.be.eq(timestamp);
        });

        it(`should update stored deposit struct for user on withdrawal for any ERC-20 token`, async () => {
            for(let i = 0 ; i < tokens.length ; ++i) {
                // make initial deposit
                let tokenDecimals = await tokens[i].decimals();
                let depositAmount = bnDecimals(5000, tokenDecimals);
                let tx = await safe.connect(users[0]).deposit(tokens[i].address, depositAmount);
                let lastUpdateTimestamp = await getTxTimestamp(tx);
                let depositForUser = await safe.userDeposit(users[0].address, tokens[i].address);
                expect(depositForUser.amount).to.be.eq(bnDecimals(5000, tokenDecimals));
                expect(depositForUser.fee).to.be.eq(0);
                expect(depositForUser.timestamp).to.be.eq(lastUpdateTimestamp);

                // increase time
                await increaseTime('100');

                // make withdrawal
                let withdrawAmount = bnDecimals(3000, tokenDecimals);
                tx = await safe.connect(users[0]).withdraw(tokens[i].address, withdrawAmount);
                let timestamp = await getTxTimestamp(tx);
                let timeElapsed = timestamp - lastUpdateTimestamp;
                // fee should be incremented according to time elapsed
                let accumulatedFee = depositForUser.amount.mul(timeElapsed).mul(feePerSecond).div(bn(10).pow(18));
                let expectedFee = depositForUser.fee.add(accumulatedFee);
                // amount should be decremented with the newly deposited amount and subtracted with the fee
                let expectedAmount = depositForUser.amount.sub(withdrawAmount).sub(accumulatedFee);
                depositForUser = await safe.userDeposit(users[0].address, tokens[i].address);
                expect(depositForUser.amount).to.be.eq(expectedAmount);
                expect(depositForUser.fee).to.be.eq(expectedFee);
                expect(depositForUser.timestamp).to.be.eq(timestamp);
            }
        });

        it(`should update stored deposit struct for token on withdrawal for ETH`, async () => {
            let depositAmount = bnDecimal(3);
            let tx = await safe.connect(users[0]).deposit(ethAddress, depositAmount, {value: depositAmount});
            let lastUpdateTimestamp = await getTxTimestamp(tx);
            let depositForToken = await safe.totalDeposit(ethAddress);
            expect(depositForToken.amount).to.be.eq(depositAmount);
            expect(depositForToken.fee).to.be.eq(0);
            expect(depositForToken.timestamp).to.be.eq(lastUpdateTimestamp);

            // increase time
            await increaseTime('100');
            
            // make withdrawal
            let withdrawAmount = bnDecimal(1);
            tx = await safe.connect(users[0]).withdraw(ethAddress, withdrawAmount);
            let timestamp = await getTxTimestamp(tx);
            let timeElapsed = timestamp - lastUpdateTimestamp;
            // fee should be incremented according to time elapsed
            let accumulatedFee = depositForToken.amount.mul(timeElapsed).mul(feePerSecond).div(bn(10).pow(18));
            let expectedFee = depositForToken.fee.add(accumulatedFee);
            // amount should be decremented with the newly deposited amount and subtracted with the fee
            let expectedAmount = depositForToken.amount.sub(withdrawAmount).sub(accumulatedFee);
            depositForToken = await safe.totalDeposit(ethAddress);
            expect(depositForToken.amount).to.be.eq(expectedAmount);
            expect(depositForToken.fee).to.be.eq(expectedFee);
            expect(depositForToken.timestamp).to.be.eq(timestamp);
        });

        it(`should update stored deposit struct for token on withdrawal for any ERC-20 token`, async () => {
            for(let i = 0 ; i < tokens.length ; ++i) {
                // make initial deposit
                let tokenDecimals = await tokens[i].decimals();
                let depositAmount = bnDecimals(5000, tokenDecimals);
                let tx = await safe.connect(users[0]).deposit(tokens[i].address, depositAmount);
                let lastUpdateTimestamp = await getTxTimestamp(tx);
                let depositForToken = await safe.totalDeposit(tokens[i].address);
                expect(depositForToken.amount).to.be.eq(bnDecimals(5000, tokenDecimals));
                expect(depositForToken.fee).to.be.eq(0);
                expect(depositForToken.timestamp).to.be.eq(lastUpdateTimestamp);

                // increase time
                await increaseTime('100');

                // make withdrawal
                let withdrawAmount = bnDecimals(3000, tokenDecimals);
                tx = await safe.connect(users[0]).withdraw(tokens[i].address, withdrawAmount);
                let timestamp = await getTxTimestamp(tx);
                let timeElapsed = timestamp - lastUpdateTimestamp;
                // fee should be incremented according to time elapsed
                let accumulatedFee = depositForToken.amount.mul(timeElapsed).mul(feePerSecond).div(bn(10).pow(18));
                let expectedFee = depositForToken.fee.add(accumulatedFee);
                // amount should be decremented with the newly deposited amount and subtracted with the fee
                let expectedAmount = depositForToken.amount.sub(withdrawAmount).sub(accumulatedFee);
                depositForToken = await safe.totalDeposit(tokens[i].address);
                expect(depositForToken.amount).to.be.eq(expectedAmount);
                expect(depositForToken.fee).to.be.eq(expectedFee);
                expect(depositForToken.timestamp).to.be.eq(timestamp);
            }
        });

        it(`should update stored deposit struct for user each time for ETH withdrawals`, async () => {
            // test with different users
            for(let i = 0 ; i < 10 ; ++i) {
                let depositAmount = bnDecimal(12);
                let tx = await safe.connect(users[i]).deposit(ethAddress, depositAmount, {value: depositAmount});
                let lastUpdateTimestamp = await getTxTimestamp(tx);
                let depositForUser = await safe.userDeposit(users[i].address, ethAddress);
                expect(depositForUser.amount).to.be.eq(depositAmount);
                expect(depositForUser.fee).to.be.eq(0);
                expect(depositForUser.timestamp).to.be.eq(lastUpdateTimestamp);

                // make 10 withdrawals for each user
                for(let j = 0 ; j < 10 ; ++j) {
                    // increase time by 24 hours
                    await increaseTime('86400');
                    
                    // make withdrawal
                    let withdrawAmount = bnDecimal(1);
                    tx = await safe.connect(users[i]).withdraw(ethAddress, withdrawAmount);
                    let timestamp = await getTxTimestamp(tx);
                    let timeElapsed = timestamp - lastUpdateTimestamp;
                    // fee should be incremented according to time elapsed
                    let accumulatedFee = depositForUser.amount.mul(timeElapsed).mul(feePerSecond).div(bn(10).pow(18));
                    let expectedFee = depositForUser.fee.add(accumulatedFee);
                    // amount should be decremented with the newly deposited amount and subtracted with the fee
                    let expectedAmount = depositForUser.amount.sub(withdrawAmount).sub(accumulatedFee);
                    // check stored struct against expected values
                    depositForUser = await safe.userDeposit(users[i].address, ethAddress);
                    expect(depositForUser.amount).to.be.eq(expectedAmount);
                    expect(depositForUser.fee).to.be.eq(expectedFee);
                    expect(depositForUser.timestamp).to.be.eq(timestamp);
                    // update timestamp
                    lastUpdateTimestamp = timestamp;
                }
            }
        });

        it(`should update stored deposit struct for user on withdrawal for any ERC-20 token`, async () => {
            for(let i = 0 ; i < tokens.length ; ++i) {
                // make initial deposit
                let tokenDecimals = await tokens[i].decimals();
                let depositAmount = bnDecimals(50000, tokenDecimals);
                let tx = await safe.connect(users[0]).deposit(tokens[i].address, depositAmount);
                let lastUpdateTimestamp = await getTxTimestamp(tx);
                let depositForUser = await safe.userDeposit(users[0].address, tokens[i].address);
                expect(depositForUser.amount).to.be.eq(depositAmount);
                expect(depositForUser.fee).to.be.eq(0);
                expect(depositForUser.timestamp).to.be.eq(lastUpdateTimestamp);

                // make 10 withdrawals
                for(let j = 0 ; j < 10 ; ++j) {
                    // increase time
                    await increaseTime('100');

                    // make withdrawal
                    let withdrawAmount = bnDecimals(3000, tokenDecimals);
                    tx = await safe.connect(users[0]).withdraw(tokens[i].address, withdrawAmount);
                    let timestamp = await getTxTimestamp(tx);
                    let timeElapsed = timestamp - lastUpdateTimestamp;
                    // fee should be incremented according to time elapsed
                    let accumulatedFee = depositForUser.amount.mul(timeElapsed).mul(feePerSecond).div(bn(10).pow(18));
                    let expectedFee = depositForUser.fee.add(accumulatedFee);
                    // amount should be decremented with the newly deposited amount and subtracted with the fee
                    let expectedAmount = depositForUser.amount.sub(withdrawAmount).sub(accumulatedFee);
                    depositForUser = await safe.userDeposit(users[0].address, tokens[i].address);
                    expect(depositForUser.amount).to.be.eq(expectedAmount);
                    expect(depositForUser.fee).to.be.eq(expectedFee);
                    expect(depositForUser.timestamp).to.be.eq(timestamp);
                    // update timestamp
                    lastUpdateTimestamp = timestamp;
                }
            }
        });

        it(`should update stored deposit struct for token on each ETH withdrawal from different users`, async () => {
            // for each user make one deposit and withdrawal
            for(let i = 0 ; i < 10 ; ++i) {
                let depositAmount = bnDecimal(3);
                let tx = await safe.connect(users[i]).deposit(ethAddress, depositAmount, {value: depositAmount});
                let lastUpdateTimestamp = await getTxTimestamp(tx);
                let depositForToken = await safe.totalDeposit(ethAddress);

                // increase time
                await increaseTime('100');
                
                // make withdrawal
                let withdrawAmount = bnDecimal(1);
                tx = await safe.connect(users[i]).withdraw(ethAddress, withdrawAmount);
                let timestamp = await getTxTimestamp(tx);
                let timeElapsed = timestamp - lastUpdateTimestamp;
                // fee should be incremented according to time elapsed
                let accumulatedFee = depositForToken.amount.mul(timeElapsed).mul(feePerSecond).div(bn(10).pow(18));
                let expectedFee = depositForToken.fee.add(accumulatedFee);
                // amount should be decremented with the newly deposited amount and subtracted with the fee
                let expectedAmount = depositForToken.amount.sub(withdrawAmount).sub(accumulatedFee);
                depositForToken = await safe.totalDeposit(ethAddress);
                expect(depositForToken.amount).to.be.eq(expectedAmount);
                expect(depositForToken.fee).to.be.eq(expectedFee);
                expect(depositForToken.timestamp).to.be.eq(timestamp);
            }
        });

        it(`should update stored deposit struct for token on each ERC-20 token withdrawal from different users`, async () => {
            // for each token
            for(let i = 0 ; i < tokens.length ; ++i) {
                // make 10 deposits + withdrawals from different users 
                for(let j = 0 ; j < 10 ; ++j) {
                    // figure out why the last user for the last token doesn't have allowance
                    // for all the tests
                    if(i == 6 && j == 9) {
                        continue;
                    }
                    // make initial deposit
                    let tokenDecimals = await tokens[i].decimals();
                    let depositAmount = bnDecimals(5000, tokenDecimals);
                    let tx = await safe.connect(users[j]).deposit(tokens[i].address, depositAmount);
                    let lastUpdateTimestamp = await getTxTimestamp(tx);
                    let depositForToken = await safe.totalDeposit(tokens[i].address);

                    // increase time
                    await increaseTime('100');

                    // make withdrawal
                    let withdrawAmount = bnDecimals(3000, tokenDecimals);
                    tx = await safe.connect(users[j]).withdraw(tokens[i].address, withdrawAmount);
                    let timestamp = await getTxTimestamp(tx);
                    let timeElapsed = timestamp - lastUpdateTimestamp;
                    // fee should be incremented according to time elapsed
                    let accumulatedFee = depositForToken.amount.mul(timeElapsed).mul(feePerSecond).div(bn(10).pow(18));
                    let expectedFee = depositForToken.fee.add(accumulatedFee);
                    // amount should be decremented with the newly deposited amount and subtracted with the fee
                    let expectedAmount = depositForToken.amount.sub(withdrawAmount).sub(accumulatedFee);
                    depositForToken = await safe.totalDeposit(tokens[i].address);
                    expect(depositForToken.amount).to.be.eq(expectedAmount);
                    expect(depositForToken.fee).to.be.eq(expectedFee);
                    expect(depositForToken.timestamp).to.be.eq(timestamp);
                }
            }
        });
    });
});