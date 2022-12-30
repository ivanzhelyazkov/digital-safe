// SPDX-License-Identifier: ISC
pragma solidity ^0.8.16;

library Errors {
    // Invalid ETH amount sent with deposit transaction
    error InvalidAmountSent();
    // User is attempting to deposit 0
    error InvalidDepositAmount();
    // User is attempting to withdraw 0
    error InvalidWithdrawAmount();
    // User is attempting to withdraw more than his available balance
    error InvalidWithdrawal();
    // ETH transfer has failed
    error ETHTransferFailed();
    // Fee collection to 0x0 address
    error InvalidFeeCollectionAddress();
    // Attempting to collect fees but no deposits for token
    error NoDepositsForToken();
}
