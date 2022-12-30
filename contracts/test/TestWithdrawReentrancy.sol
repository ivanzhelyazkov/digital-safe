// SPDX-License-Identifier: ISC
pragma solidity ^0.8.16;

import {IDigitalSafe} from "../interface/IDigitalSafe.sol";

/**
 * Special contract which tests reentrancy protection in withdraw function
 */
contract TestWithdrawReentrancy {
    IDigitalSafe safe;

    constructor(IDigitalSafe _safe) {
        safe = _safe;
    }

    function deposit(address token, uint amount) external payable {
        safe.deposit{value: amount} (token, amount);
    }

    function withdraw(address token, uint amount) external {
        safe.withdraw(token, amount);
    }

    receive() external payable {
        // Attempt reentrancy in withdraw
        safe.withdraw(safe.ethAddress(), 1);
    }
}