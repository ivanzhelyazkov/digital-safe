// SPDX-License-Identifier: ISC
pragma solidity ^0.8.16;

import {IDigitalSafe} from "../interface/IDigitalSafe.sol";

/**
 * Special contract which tests reentrancy protection in deposit function
 */
contract TestDepositReentrancy {
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
        // Attempt reentrancy in deposit
        safe.deposit{value: msg.value}(safe.ethAddress(), msg.value);
    }
}