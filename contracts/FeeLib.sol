// SPDX-License-Identifier: ISC
pragma solidity ^0.8.16;

/**
 * @notice Library which handles fee calculation logic
 */
library FeeLib {
    /**
     * @notice Calculate new deposit amount on user deposit
     */
    function getUpdatedAmountOnDeposit(
        uint128 initialAmount,
        uint depositAmount,
        uint fee
    ) internal pure returns (uint128 updatedAmount) {
        return uint128(initialAmount + depositAmount - fee);
    }

    /**
     * @notice Calculate new deposit amount on user withdraw
     */
    function getUpdatedAmountOnWithdrawal(
        uint128 initialAmount,
        uint withdrawAmount,
        uint fee
    ) internal pure returns (uint128 updatedAmount) {
        return uint128(initialAmount - withdrawAmount - fee);
    }

    /**
     * @notice Calculate new deposit amount on fee collection
     */
    function getUpdatedAmountOnFeeCollection(
        uint128 initialAmount,
        uint fee
    ) internal pure returns (uint128 updatedAmount) {
        return uint128(initialAmount - fee);
    }

    /**
     * @notice Calculate fees accumulated for amount since a given timestamp
     */
    function calculateFeesSinceTimestamp(
        uint timestamp,
        uint amount,
        uint feePerSecond
    ) internal view returns (uint96 accumulatedFees) {
        uint timePassed = block.timestamp - timestamp;
        accumulatedFees = uint96((amount * timePassed * feePerSecond) / 1e18);
    }
}
