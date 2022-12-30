import { expect } from 'chai';
import { TestFeeLib } from '../typechain';
import { bn, bnDecimal, deploy, getBlockTimestamp } from '../scripts/helpers';
import { PANIC_CODES } from "@nomicfoundation/hardhat-chai-matchers/panic";
import { BigNumber } from 'ethers';


describe('FeeLib', () => {
    let feeLib: TestFeeLib;

    beforeEach(async () => {
        feeLib = <TestFeeLib>await deploy('TestFeeLib');
    });

    describe('Fee calculation', () => {
        const feeCalculation = (timestamp: number, amount: number, feePerSecond: number) => {
            it(`feeCalculation(${timestamp}, ${amount}, ${feePerSecond})`, async () => {
                let currTimestamp = await getBlockTimestamp();
                if (timestamp <= currTimestamp) {
                    const result = await feeLib.calculateFeesSinceTimestamp(timestamp, amount, feePerSecond);
                    const timePassed = currTimestamp - timestamp;
                    const expected = bn(amount).mul(timePassed).mul(feePerSecond).div(bn(10).pow(18));
                    expect(result).to.equal(expected);
                } else {
                    await expect(
                        feeLib.calculateFeesSinceTimestamp(timestamp, amount, feePerSecond)
                    ).to.be.revertedWithPanic(PANIC_CODES.ARITHMETIC_UNDER_OR_OVERFLOW);
                }
            });
        };

        describe('Fee calculation', () => {
            let feesPerSecond: any[] = new Array(0);
            let timestamps: any[] = new Array(0);
            let amounts: any[] = new Array(0);
            
            for(let i = 1 ; i < 6  ; ++i) {
                feesPerSecond.push(bnDecimal(i).div(1e4).div(24 * 60 * 60))
            }
            // 29 Dec 2022 timestamp = 1672301776
            // Get timestamps every 100 000 seconds before
            let timestamp = 1672301776;
            for(let i = 0 ; i < 5 ; ++i) {
                timestamps.push(timestamp)
                timestamp -= i * 100000;
            }
            // get amounts from 1000 to 243 000
            let amount = bnDecimal(1000)
            for(let i = 0 ; i < 5 ; ++i) {
                amounts.push(amount);
                amount = amount.mul(3);
            }
            for (const timestamp of timestamps) {
                for (const amount of amounts) {
                    for (const feePerSecond of feesPerSecond) {
                        feeCalculation(timestamp, amount, feePerSecond);
                    }
                }
            }
            // test with bigger timestamp
            feeCalculation(1924763962, amounts[0], feesPerSecond[0]);
        });
    });

    describe('Get updated amounts', () => {
        let initialAmounts: any[] = new Array(0);
        let updateAmounts: any[] = new Array(0);
        let fees: any[] = new Array(0);
        let amount = bnDecimal(1000);
        for(let i = 0 ; i < 5  ; ++i) {
            initialAmounts.push(amount);
            amount = amount.mul(3);
        }
        let updateAmount = bnDecimal(100);
        for(let i = 0 ; i < 5  ; ++i) {
            updateAmounts.push(updateAmount);
            updateAmount = updateAmount.mul(2);
        }
        let fee = bnDecimal(1);
        for(let i = 0 ; i < 5  ; ++i) {
            fees.push(fee);
            fee = fee.mul(3);
        }

        const updatedAmountOnDeposit = (initialAmount: BigNumber, depositAmount: BigNumber, fee: BigNumber) => {
            it(`updatedAmountOnDeposit(${initialAmount}, ${depositAmount}, ${fee})`, async () => {
                let result = await feeLib.getUpdatedAmountOnDeposit(initialAmount, depositAmount, fee);
                let expected = initialAmount.add(depositAmount).sub(fee)
                expect(result).to.be.eq(expected);
            });
        };

        const updatedAmountOnWithdraw = (initialAmount: BigNumber, withdrawAmount: BigNumber, fee: BigNumber) => {
            it(`updatedAmountOnWithdraw(${initialAmount}, ${withdrawAmount}, ${fee})`, async () => {
                if(initialAmount.gt(withdrawAmount.add(fee))) {
                    let result = await feeLib.getUpdatedAmountOnWithdrawal(initialAmount, withdrawAmount, fee);
                    let expected = initialAmount.sub(withdrawAmount).sub(fee)
                    expect(result).to.be.eq(expected);
                } else {
                    await expect(
                        feeLib.getUpdatedAmountOnWithdrawal(initialAmount, withdrawAmount, fee)
                    ).to.be.revertedWithPanic(PANIC_CODES.ARITHMETIC_UNDER_OR_OVERFLOW);
                }
            });
        };

        const updatedAmountOnFeeCollection = (initialAmount: BigNumber, fee: BigNumber) => {
            it(`updatedAmountOnFeeCollection(${initialAmount}, ${fee})`, async () => {
                let result = await feeLib.getUpdatedAmountOnFeeCollection(initialAmount, fee);
                let expected = initialAmount.sub(fee)
                expect(result).to.be.eq(expected);
            });
        };

        describe('Get updated amounts on deposit', () => {
            for (const initialAmount of initialAmounts) {
                for (const updateAmount of updateAmounts) {
                    for (const fee of fees) {
                        updatedAmountOnDeposit(initialAmount, updateAmount, fee);
                    }
                }
            }
        });

        describe('Get updated amounts on withdraw', () => {
            for (const initialAmount of initialAmounts) {
                for (const updateAmount of updateAmounts) {
                    for (const fee of fees) {
                        updatedAmountOnWithdraw(initialAmount, updateAmount, fee);
                    }
                }
            }
        });

        describe('Get updated amounts on fee collection', () => {
            for (const initialAmount of initialAmounts) {
                for (const fee of fees) {
                    updatedAmountOnFeeCollection(initialAmount, fee);
                }
            }
        });
    });
});
