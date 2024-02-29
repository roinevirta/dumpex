// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "contracts/imports/MockERC20_decimals.sol";

contract MockERC20decimals is ERC20 {
    constructor(string memory name, string memory symbol, uint8 decimals) ERC20(name, symbol, decimals) {}

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}
