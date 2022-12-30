// SPDX-License-Identifier: ISC
pragma solidity ^0.8.16;

import {IDigitalSafe} from "../interface/IDigitalSafe.sol";

/**
 * Special contract which tests revert on receive()
 */
contract TestRevertReceive {
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
        revert();
    }
}