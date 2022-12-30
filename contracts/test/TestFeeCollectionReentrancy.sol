// SPDX-License-Identifier: ISC
pragma solidity ^0.8.16;

import {IDigitalSafe} from "../interface/IDigitalSafe.sol";

/**
 * Special contract which tests reentrancy protection in fee collection function
 */
contract TestFeeCollectionReentrancy {
    IDigitalSafe safe;

    constructor(IDigitalSafe _safe) {
        safe = _safe;
    }

    function deposit(address token, uint amount) external payable {
        safe.deposit{value: amount} (token, amount);
    }

    function collectFees(address token) external {
        safe.collectFees(token, address(this));
    }

    receive() external payable {
        // Attempt reentrancy in collect fees
        safe.collectFees(safe.ethAddress(), address(this));
    }
}