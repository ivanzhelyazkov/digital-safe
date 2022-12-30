//SPDX-License-Identifier: ISC
pragma solidity ^0.8.16;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    uint8 _decimals;

    constructor(string memory name, string memory symbol, uint8 __decimals) ERC20(name, symbol) {
        _decimals = __decimals;
        _mint(msg.sender, 10000000000000000000 * 10 ** uint256(decimals()));
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}
