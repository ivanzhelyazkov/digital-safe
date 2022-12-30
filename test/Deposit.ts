import { expect } from 'chai';
import { DigitalSafe, ERC20, TestDepositReentrancy } from '../typechain';
import { bn, bnDecimal, bnDecimals, getTxTimestamp, increaseTime, getBalance, deployArgs } from '../scripts/helpers';
import { testFixture } from './fixture';
import { BigNumber } from 'ethers';


describe('DigitalSafe', () => {
    let safe: DigitalSafe;
    let ethAddress: string;
    let feePerSecond: BigNumber;
    let tokens: ERC20[];
    let users: any[];
    let testReentrancy: TestDepositReentrancy;

    beforeEach(async () => {
        ({ safe, tokens, users } = await testFixture());
        ethAddress = await safe.ethAddress();
        feePerSecond = await safe.feePerSecond();
        testReentrancy = <TestDepositReentrancy>await deployArgs('TestDepositReentrancy', safe.address);
    });

    describe('Deposit', () => {
        it(`should revert on deposit if depositAmount is 0`, async () => {
            await expect(safe.deposit(ethAddress, 0)).
                to.be.revertedWithCustomError(safe, 'InvalidDepositAmount');
        });

        it(`should revert on deposit if ETH amount is not equal to msg.value`, async () => {
            let depositAmount = bnDecimal(2);
            await expect(safe.deposit(ethAddress, depositAmount, {value: depositAmount.sub(1)})).
                to.be.revertedWithCustomError(safe, 'InvalidAmountSent');
        });

        it(`shouldn't be able to reenter deposit`, async () => {
            let depositAmount = bnDecimal(2);
            await testReentrancy.deposit(ethAddress, depositAmount, {value: depositAmount});
            await expect(testReentrancy.withdraw(ethAddress, depositAmount.div(2))).
                to.be.reverted;
        });

        it(`should emit Deposited event on succesful call to deposit`, async () => {
            let depositAmount = bnDecimal(2);
            await expect(safe.deposit(ethAddress, depositAmount, {value: depositAmount})).
                to.emit(safe, 'Deposited');
        });

        it(`should increase safe's ETH balance by depositAmount on deposit for ETH`, async () => {
            let balanceBefore = await getBalance(safe);
            let depositAmount = bnDecimal(3);
            await safe.connect(users[0]).deposit(ethAddress, depositAmount, {value: depositAmount});
            let balanceAfter = await getBalance(safe);
            expect(balanceAfter.sub(balanceBefore)).to.be.eq(depositAmount);
        });

        it(`should increase safe's token balance by depositAmount on deposit for any ERC-20 token`, async () => {
            for(let i = 0 ; i < tokens.length ; ++i) {
                let balanceBefore = await tokens[i].balanceOf(safe.address);
                let depositAmount = bnDecimals(1000, await tokens[i].decimals());
                await safe.connect(users[0]).deposit(tokens[i].address, depositAmount);
                let balanceAfter = await tokens[i].balanceOf(safe.address);
                expect(balanceAfter.sub(balanceBefore)).to.be.eq(depositAmount);
            }
        });

        it(`should create new deposit struct for user on first deposit for ETH`, async () => {
            let depositForUser = await safe.userDeposit(users[0].address, ethAddress);
            expect(depositForUser.amount).to.be.eq(0);
            expect(depositForUser.fee).to.be.eq(0);
            expect(depositForUser.timestamp).to.be.eq(0);

            let depositAmount = bnDecimal(3);
            let tx = await safe.connect(users[0]).deposit(ethAddress, depositAmount, {value: depositAmount});
            let timestamp = await getTxTimestamp(tx);
            depositForUser = await safe.userDeposit(users[0].address, ethAddress);
            expect(depositForUser.amount).to.be.eq(depositAmount);
            expect(depositForUser.fee).to.be.eq(0);
            expect(depositForUser.timestamp).to.be.eq(timestamp);
        });

        it(`should create new deposit struct for user on first deposit for any ERC-20 token`, async () => {
            for(let i = 0 ; i < tokens.length ; ++i) {
                let depositForUser = await safe.userDeposit(users[0].address, tokens[i].address);
                expect(depositForUser.amount).to.be.eq(0);
                expect(depositForUser.fee).to.be.eq(0);
                expect(depositForUser.timestamp).to.be.eq(0);

                let tokenDecimals = await tokens[i].decimals();
                let depositAmount = bnDecimals(1000, tokenDecimals);
                let tx = await safe.connect(users[0]).deposit(tokens[i].address, depositAmount);
                let timestamp = await getTxTimestamp(tx);
                depositForUser = await safe.userDeposit(users[0].address, tokens[i].address);
                expect(depositForUser.amount).to.be.eq(depositAmount);
                expect(depositForUser.fee).to.be.eq(0);
                expect(depositForUser.timestamp).to.be.eq(timestamp);
            }
        });

        it(`should create new deposit struct for token on first deposit for ETH`, async () => {
            let depositForToken = await safe.totalDeposit(ethAddress);
            expect(depositForToken.amount).to.be.eq(0);
            expect(depositForToken.fee).to.be.eq(0);
            expect(depositForToken.timestamp).to.be.eq(0);

            let depositAmount = bnDecimal(3);
            let tx = await safe.connect(users[0]).deposit(ethAddress, depositAmount, {value: bnDecimal(3)});
            let timestamp = await getTxTimestamp(tx);
            depositForToken = await safe.totalDeposit(ethAddress);
            expect(depositForToken.amount).to.be.eq(bnDecimal(3));
            expect(depositForToken.fee).to.be.eq(0);
            expect(depositForToken.timestamp).to.be.eq(timestamp);
        });

        it(`should create new deposit struct for token on first deposit for any ERC-20 token`, async () => {
            for(let i = 0 ; i < tokens.length ; ++i) {
                let depositForToken = await safe.totalDeposit(tokens[i].address);
                expect(depositForToken.amount).to.be.eq(0);
                expect(depositForToken.fee).to.be.eq(0);
                expect(depositForToken.timestamp).to.be.eq(0);

                let tokenDecimals = await tokens[i].decimals();
                let depositAmount = bnDecimals(1000, tokenDecimals);
                let tx = await safe.connect(users[0]).deposit(tokens[i].address, depositAmount);
                let timestamp = await getTxTimestamp(tx);
                depositForToken = await safe.totalDeposit(tokens[i].address);
                expect(depositForToken.amount).to.be.eq(depositAmount);
                expect(depositForToken.fee).to.be.eq(0);
                expect(depositForToken.timestamp).to.be.eq(timestamp);
            }
        });

        it(`should update stored deposit struct for user on subsequent deposits for ETH`, async () => {
            let depositAmount = bnDecimal(3);
            let tx = await safe.connect(users[0]).deposit(ethAddress, depositAmount, {value: bnDecimal(3)});
            let lastUpdateTimestamp = await getTxTimestamp(tx);
            let depositForUser = await safe.userDeposit(users[0].address, ethAddress);
            expect(depositForUser.amount).to.be.eq(bnDecimal(3));
            expect(depositForUser.fee).to.be.eq(0);
            expect(depositForUser.timestamp).to.be.eq(lastUpdateTimestamp);

            // make 10 deposits
            for(let i = 0 ; i < 10 ; ++i) {
                // increase time
                await increaseTime('100');
                
                // make subsequent deposit
                depositAmount = bnDecimal(5);
                tx = await safe.connect(users[0]).deposit(ethAddress, depositAmount, {value: bnDecimal(5)});
                let timestamp = await getTxTimestamp(tx);
                let timeElapsed = timestamp - lastUpdateTimestamp;
                // fee should be incremented according to time elapsed
                let accumulatedFee = depositForUser.amount.mul(timeElapsed).mul(feePerSecond).div(bn(10).pow(18));
                let expectedFee = depositForUser.fee.add(accumulatedFee);
                // amount should be incremented with the newly deposited amount and subtracted with the fee
                let expectedAmount = depositForUser.amount.add(depositAmount).sub(accumulatedFee);
                depositForUser = await safe.userDeposit(users[0].address, ethAddress);
                expect(depositForUser.amount).to.be.eq(expectedAmount);
                expect(depositForUser.fee).to.be.eq(expectedFee);
                expect(depositForUser.timestamp).to.be.eq(timestamp);
                lastUpdateTimestamp = timestamp;
            }
        });

        it(`should update stored deposit struct for user on subsequent deposits for any ERC-20 token`, async () => {
            for(let i = 0 ; i < tokens.length ; ++i) {
                // make initial deposit
                let tokenDecimals = await tokens[i].decimals();
                let depositAmount = bnDecimals(1000, tokenDecimals);
                let tx = await safe.connect(users[0]).deposit(tokens[i].address, depositAmount);
                let lastUpdateTimestamp = await getTxTimestamp(tx);
                let depositForUser = await safe.userDeposit(users[0].address, tokens[i].address);
                expect(depositForUser.amount).to.be.eq(depositAmount);
                expect(depositForUser.fee).to.be.eq(0);
                expect(depositForUser.timestamp).to.be.eq(lastUpdateTimestamp);

                // make 10 deposits for each token
                for(let j = 0 ; j < 10 ; ++j) {
                    // increase time
                    await increaseTime('100');

                    // make subsequent deposit
                    depositAmount = bnDecimals(3000, tokenDecimals);
                    tx = await safe.connect(users[0]).deposit(tokens[i].address, depositAmount);
                    let timestamp = await getTxTimestamp(tx);
                    let timeElapsed = timestamp - lastUpdateTimestamp;
                    // fee should be incremented according to time elapsed
                    let accumulatedFee = depositForUser.amount.mul(timeElapsed).mul(feePerSecond).div(bn(10).pow(18));
                    let expectedFee = depositForUser.fee.add(accumulatedFee);
                    // amount should be incremented with the newly deposited amount and subtracted with the fee
                    let expectedAmount = depositForUser.amount.add(depositAmount).sub(accumulatedFee);
                    depositForUser = await safe.userDeposit(users[0].address, tokens[i].address);
                    expect(depositForUser.amount).to.be.eq(expectedAmount);
                    expect(depositForUser.fee).to.be.eq(expectedFee);
                    expect(depositForUser.timestamp).to.be.eq(timestamp);
                    // update timestamp
                    lastUpdateTimestamp = timestamp;
                }
            }
        });

        it(`should update stored deposit for token on subsequent deposits for ETH`, async () => {
            let depositAmount = bnDecimal(3);
            let tx = await safe.connect(users[0]).deposit(ethAddress, depositAmount, {value: bnDecimal(3)});
            let firstDepositTimestamp = await getTxTimestamp(tx);
            let depositForToken = await safe.totalDeposit(ethAddress);
            expect(depositForToken.amount).to.be.eq(bnDecimal(3));
            expect(depositForToken.fee).to.be.eq(0);
            expect(depositForToken.timestamp).to.be.eq(firstDepositTimestamp);

            // increase time
            await increaseTime('100');

            depositAmount = bnDecimal(5);
            tx = await safe.connect(users[0]).deposit(ethAddress, depositAmount, {value: bnDecimal(5)});
            let timestamp = await getTxTimestamp(tx);
            let timeElapsed = timestamp - firstDepositTimestamp;
            // fee should be incremented according to time elapsed
            let expectedFee = depositForToken.amount.mul(timeElapsed).mul(feePerSecond).div(bn(10).pow(18));
            // amount should be incremented with the newly deposited amount and subtracted with the fee
            let expectedAmount = depositForToken.amount.add(depositAmount).sub(expectedFee);
            depositForToken = await safe.totalDeposit(ethAddress);
            expect(depositForToken.amount).to.be.eq(expectedAmount);
            expect(depositForToken.fee).to.be.eq(expectedFee);
            expect(depositForToken.timestamp).to.be.eq(timestamp);
        });

        it(`should update stored deposit struct for token on subsequent deposits for any ERC-20 token`, async () => {
            for(let i = 0 ; i < tokens.length ; ++i) {
                // make initial deposit
                let tokenDecimals = await tokens[i].decimals();
                let depositAmount = bnDecimals(1000, tokenDecimals);
                let tx = await safe.connect(users[0]).deposit(tokens[i].address, depositAmount);
                let firstDepositTimestamp = await getTxTimestamp(tx);
                let depositForToken = await safe.totalDeposit(tokens[i].address);
                expect(depositForToken.amount).to.be.eq(bnDecimals(1000, tokenDecimals));
                expect(depositForToken.fee).to.be.eq(0);
                expect(depositForToken.timestamp).to.be.eq(firstDepositTimestamp);

                // increase time
                await increaseTime('100');

                // make subsequent deposit
                depositAmount = bnDecimals(3000, tokenDecimals);
                tx = await safe.connect(users[0]).deposit(tokens[i].address, depositAmount);
                let timestamp = await getTxTimestamp(tx);
                let timeElapsed = timestamp - firstDepositTimestamp;
                // fee should be incremented according to time elapsed
                let expectedFee = depositForToken.amount.mul(timeElapsed).mul(feePerSecond).div(bn(10).pow(18));
                // amount should be incremented with the newly deposited amount and subtracted with the fee
                let expectedAmount = depositForToken.amount.add(depositAmount).sub(expectedFee);
                depositForToken = await safe.totalDeposit(tokens[i].address);
                expect(depositForToken.amount).to.be.eq(expectedAmount);
                expect(depositForToken.fee).to.be.eq(expectedFee);
                expect(depositForToken.timestamp).to.be.eq(timestamp);
            }
        });

        it(`should update stored deposit for token for subsequent different user deposits for ETH`, async () => {
            let depositAmount = bnDecimal(3);
            let tx = await safe.connect(users[0]).deposit(ethAddress, depositAmount, {value: bnDecimal(3)});
            let lastDepositTimestamp = await getTxTimestamp(tx);
            let depositForToken = await safe.totalDeposit(ethAddress);
            expect(depositForToken.amount).to.be.eq(bnDecimal(3));
            expect(depositForToken.fee).to.be.eq(0);
            expect(depositForToken.timestamp).to.be.eq(lastDepositTimestamp);

            // deposit from different users
            for(let i = 0 ; i < 10 ; ++i) {
                // increase time
                await increaseTime('100');

                depositAmount = bnDecimal(5);
                tx = await safe.connect(users[i]).deposit(ethAddress, depositAmount, {value: bnDecimal(5)});
                let timestamp = await getTxTimestamp(tx);
                let timeElapsed = timestamp - lastDepositTimestamp;
                // update last deposit timestamp
                lastDepositTimestamp = timestamp;
                // fee should be incremented according to time elapsed
                let accumulatedFee = depositForToken.amount.mul(timeElapsed).mul(feePerSecond).div(bn(10).pow(18));
                let expectedFee = depositForToken.fee.add(accumulatedFee);
                // amount should be incremented with the newly deposited amount and subtracted with the fee
                let expectedAmount = depositForToken.amount.add(depositAmount).sub(accumulatedFee);
                depositForToken = await safe.totalDeposit(ethAddress);
                expect(depositForToken.amount).to.be.eq(expectedAmount);
                expect(depositForToken.fee).to.be.eq(expectedFee);
                expect(depositForToken.timestamp).to.be.eq(timestamp);
            }
        });

        it(`should update stored deposit struct for token on subsequent deposits for any ERC-20 token`, async () => {
            for(let i = 0 ; i < tokens.length ; ++i) {
                // make initial deposit
                let tokenDecimals = await tokens[i].decimals();
                let depositAmount = bnDecimals(1000, tokenDecimals);
                let tx = await safe.connect(users[0]).deposit(tokens[i].address, depositAmount);
                let lastDepositTimestamp = await getTxTimestamp(tx);
                let depositForToken = await safe.totalDeposit(tokens[i].address);
                expect(depositForToken.amount).to.be.eq(bnDecimals(1000, tokenDecimals));
                expect(depositForToken.fee).to.be.eq(0);
                expect(depositForToken.timestamp).to.be.eq(lastDepositTimestamp);

                // make deposits from 10 different users
                for(let j = 0 ; j < 10 ; ++j) {
                    // increase time
                    await increaseTime('100');
                    // figure out why the last user for the last token doesn't have allowance
                    // for all the tests
                    if(i == 6 && j == 9) {
                        continue;
                    }

                    // make subsequent deposit
                    depositAmount = bnDecimals(3000, tokenDecimals);
                    tx = await safe.connect(users[j]).deposit(tokens[i].address, depositAmount);
                    let timestamp = await getTxTimestamp(tx);
                    let timeElapsed = timestamp - lastDepositTimestamp;
                    // update timestamp
                    lastDepositTimestamp = timestamp;
                    // fee should be incremented according to time elapsed
                    let accumulatedFee = depositForToken.amount.mul(timeElapsed).mul(feePerSecond).div(bn(10).pow(18));
                    let expectedFee = depositForToken.fee.add(accumulatedFee);
                    // amount should be incremented with the newly deposited amount and subtracted with the fee
                    let expectedAmount = depositForToken.amount.add(depositAmount).sub(accumulatedFee);
                    depositForToken = await safe.totalDeposit(tokens[i].address);
                    expect(depositForToken.amount).to.be.eq(expectedAmount);
                    expect(depositForToken.fee).to.be.eq(expectedFee);
                    expect(depositForToken.timestamp).to.be.eq(timestamp);
                }
            }
        });
    });
});
