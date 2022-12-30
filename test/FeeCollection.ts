import { expect } from 'chai';
import { DigitalSafe, ERC20, TestFeeCollectionReentrancy, TestRevertReceive } from '../typechain';
import { bn, bnDecimal, bnDecimals, getTxTimestamp, increaseTime, getBalance, deployArgs } from '../scripts/helpers';
import { testFixture } from './fixture';
import { BigNumber, constants } from 'ethers';


describe('DigitalSafe', () => {
    let safe: DigitalSafe;
    let ethAddress: string;
    let feePerSecond: BigNumber;
    let tokens: ERC20[];
    let users: any[];
    let testRevertReceive: TestRevertReceive;
    let testReentrancy: TestFeeCollectionReentrancy;

    beforeEach(async () => {
        ({ safe, tokens, users } = await testFixture());
        ethAddress = await safe.ethAddress();
        feePerSecond = await safe.feePerSecond();
        testRevertReceive = <TestRevertReceive>await deployArgs('TestRevertReceive', safe.address);
        testReentrancy = <TestFeeCollectionReentrancy>await deployArgs('TestFeeCollectionReentrancy', safe.address);
    });

    describe('Fee Collection', () => {
        it(`should revert if called by address other than owner`, async () => {
            await expect(safe.connect(users[1]).collectFees(ethAddress, users[1].address)).
                to.be.revertedWith('Ownable: caller is not the owner');
        });

        it(`should revert on fee collection to 0x0 address`, async () => {
            await expect(safe.collectFees(ethAddress, constants.AddressZero)).
                to.be.revertedWithCustomError(safe, 'InvalidFeeCollectionAddress');
        });

        it(`should revert on fee collection if no deposits for token`, async () => {
            await expect(safe.collectFees(ethAddress, users[0].address)).
                to.be.revertedWithCustomError(safe, 'NoDepositsForToken');
        });

        it(`should revert on fail to transfer ETH fees to address`, async () => {
            let depositAmount = bnDecimal(3);
            await safe.deposit(ethAddress, depositAmount, {value: depositAmount});
            await expect(safe.collectFees(ethAddress, testRevertReceive.address)).
                to.be.revertedWithCustomError(safe, 'ETHTransferFailed');
        });

        it(`shouldn't be able to reenter collectFees`, async () => {
            // transfer ownership so that reentrancy test contract is able to call collectFees
            await safe.transferOwnership(testReentrancy.address);
            let depositAmount = bnDecimal(2);
            await testReentrancy.deposit(ethAddress, depositAmount, {value: depositAmount});
            // attempt to reenter collectFees
            await expect(testReentrancy.collectFees(ethAddress)).
                to.be.reverted;
        });

        it(`should emit FeeCollected event on successful fee collection`, async () => {
            let depositAmount = bnDecimal(3);
            await safe.deposit(ethAddress, depositAmount, {value: depositAmount});
            await expect(safe.collectFees(ethAddress, users[0].address)).
                to.emit(safe, 'FeeCollected');
        });

        it(`should send fees to receiver address on successful fee collection`, async () => {
            let depositAmount = bnDecimal(3);
            await safe.deposit(ethAddress, depositAmount, {value: depositAmount});
            // increase time by 24 hours
            await increaseTime('86400');
            // fees expected are for 86400 duration + 1 second, which is the next block timestamp in hh network
            let expectedFees = depositAmount.mul(86400 + 1).mul(feePerSecond).div(bn(10).pow(18));
            let balanceBefore = await getBalance(users[1]);
            await safe.collectFees(ethAddress, users[1].address);
            let balanceAfter = await getBalance(users[1]);
            expect(balanceAfter.sub(balanceBefore)).to.be.eq(expectedFees);
        });

        it(`should send fees to receiver address on successful fee collection for any ERC-20 token`, async () => {
            for(let i = 0 ; i < tokens.length ; ++i) {
                let decimals = await tokens[i].decimals();
                let depositAmount = bnDecimals(30000, decimals);
                await safe.deposit(tokens[i].address, depositAmount);
                // increase time by 24 hours
                await increaseTime('86400');
                // fees expected are for 86400 seconds + 1 second, which is the next block timestamp in hh network
                let expectedFees = depositAmount.mul(86400 + 1).mul(feePerSecond).div(bn(10).pow(18));
                // receiver == users[1]
                let balanceBefore = await tokens[i].balanceOf(users[1].address);
                await safe.collectFees(tokens[i].address, users[1].address);
                let balanceAfter = await tokens[i].balanceOf(users[1].address);
                expect(balanceAfter.sub(balanceBefore)).to.be.closeTo(expectedFees, bnDecimals(1, decimals));
            }
        });

        it(`should update deposits struct for token on fee collection for ETH`, async () => {
            let depositAmount = bnDecimal(3);
            let tx = await safe.deposit(ethAddress, depositAmount, {value: depositAmount});
            let timestamp = await getTxTimestamp(tx);
            let depositForToken = await safe.totalDeposit(ethAddress);
            expect(depositForToken.amount).to.be.eq(depositAmount)
            expect(depositForToken.fee).to.be.eq(0)
            expect(depositForToken.timestamp).to.be.eq(timestamp)

            // increase time by 24 hours
            await increaseTime('86400');

            let expectedFees = depositAmount.mul(86400 + 1).mul(feePerSecond).div(bn(10).pow(18));
            let expectedAmount = depositAmount.sub(expectedFees);
            tx = await safe.collectFees(ethAddress, users[1].address);
            timestamp = await getTxTimestamp(tx);
            depositForToken = await safe.totalDeposit(ethAddress);
            // deposit amount gets decremented by the collected fee
            expect(depositForToken.amount).to.be.eq(expectedAmount);
            // fee gets reset on fee collection
            expect(depositForToken.fee).to.be.eq(0)
            // timestamp is updated to the block timestamp of the fee collection tx
            expect(depositForToken.timestamp).to.be.eq(timestamp)
        });

        it(`should update deposits struct for token on fee collection for any ERC-20 token`, async () => {
            for(let i = 0 ; i < tokens.length ; ++i) {
                let decimals = await tokens[i].decimals();
                let depositAmount = bnDecimals(30000, decimals);
                let tx = await safe.deposit(tokens[i].address, depositAmount);
                let timestamp = await getTxTimestamp(tx);
                let depositForToken = await safe.totalDeposit(tokens[i].address);
                expect(depositForToken.amount).to.be.eq(depositAmount)
                expect(depositForToken.fee).to.be.eq(0)
                expect(depositForToken.timestamp).to.be.eq(timestamp)

                // increase time by 24 hours
                await increaseTime('86400');

                let expectedFees = depositAmount.mul(86400 + 1).mul(feePerSecond).div(bn(10).pow(18));
                let expectedAmount = depositAmount.sub(expectedFees);
                tx = await safe.collectFees(tokens[i].address, users[1].address);
                timestamp = await getTxTimestamp(tx);
                depositForToken = await safe.totalDeposit(tokens[i].address);
                // deposit amount gets decremented by the collected fee
                expect(depositForToken.amount).to.be.closeTo(expectedAmount, bnDecimals(1, decimals));
                // fee gets reset on fee collection
                expect(depositForToken.fee).to.be.eq(0)
                // timestamp is updated to the block timestamp of the fee collection tx
                expect(depositForToken.timestamp).to.be.eq(timestamp)
            }
        });
    });
});