// SPDX-License-Identifier: ISC
pragma solidity ^0.8.16;

interface IDigitalSafe {
    function userDeposit(
        address,
        address
    ) external view returns (uint128 amount, uint96 fee, uint32 timestamp);

    function totalDeposit(
        address
    ) external view returns (uint128 amount, uint96 fee, uint32 timestamp);

    function ethAddress() external view returns (address);

    function feePerSecond() external view returns (uint256);

    /**
     * @notice Deposit an ERC-20 token or ETH in the safe
     * @dev if depositing ETH, address must send the exact `amount` as msg.value
     * @dev if depositing ERC-20, address must have approved the token
     */
    function deposit(address token, uint256 amount) external payable;

    /**
     * @notice Withdraw an ERC-20 token or ETH from the safe
     */
    function withdraw(address token, uint256 amount) external;

    /**
     * @notice Collect accumulated fees for token
     * @dev Callable only by safe owner
     * @dev Sends fees to receiver address
     */
    function collectFees(address token, address receiver) external;

    /// @dev Deposit struct
    struct Deposit {
        uint128 amount; // total deposited amount without fees
        uint96 fee; // total accumulated fees
        uint32 timestamp; // last update timestamp
    }

    // Events
    /// @dev The event that is emitted when the deposit function is called
    event Deposited(
        address indexed user,
        address indexed token,
        uint indexed amount
    );

    /// @dev The event that is emitted when the withdraw function is called
    event Withdrawal(
        address indexed user,
        address indexed token,
        uint indexed amount
    );

    /// @dev The event that is emitted when the collectFee function is called
    event FeeCollected(
        address indexed receiver,
        address indexed token,
        uint indexed amount
    );
}
