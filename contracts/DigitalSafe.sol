// SPDX-License-Identifier: ISC
pragma solidity ^0.8.16;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IDigitalSafe} from "./interface/IDigitalSafe.sol";
import {FeeLib} from "./FeeLib.sol";
import {Errors} from "./Errors.sol";

contract DigitalSafe is IDigitalSafe, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // fee per second in wei
    uint public constant feePerSecond = 0.005 ether / uint256(24 * 60 * 60); // 0.005% per 24 hours

    address public constant ethAddress =
        0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    // token => Deposit
    // tracks total amount deposited, accumulated fees and last update timestamp
    mapping(address => Deposit) public totalDeposit;

    // address => token => Deposit
    mapping(address => mapping(address => Deposit)) public userDeposit;

    constructor() Ownable() {}

    /// @inheritdoc IDigitalSafe
    function deposit(address token, uint amount) external payable nonReentrant {
        // if amount is 0
        if(amount == 0) {
            revert Errors.InvalidDepositAmount();
        }
        // if token is ETH
        if (token == ethAddress && msg.value != amount) {
            revert Errors.InvalidAmountSent();
        }

        // Get user token struct
        Deposit storage _userDeposit = userDeposit[msg.sender][token];

        // Check if this is the first deposit for the user
        if (_userDeposit.amount == 0) {
            // Record users' token entry on first deposit for a token
            userDeposit[msg.sender][token] = Deposit({
                amount: uint128(amount),
                fee: 0,
                timestamp: uint32(block.timestamp)
            });
        } else {
            // Update users deposit amount, fee and timestamp if he has deposited
            _updateOnDeposit(_userDeposit, amount);
        }

        // Get total deposits struct
        Deposit storage _totalDeposit = totalDeposit[token];
        // Check if this is the first deposit for the token
        if (_totalDeposit.amount == 0) {
            // Make a new deposit entry if this is the first deposit
            totalDeposit[token] = Deposit({
                amount: uint128(amount),
                fee: 0,
                timestamp: uint32(block.timestamp)
            });
        } else {
            // Update token deposit with the accumulated fee, amount and timestamp
            _updateOnDeposit(_totalDeposit, amount);
        }

        // Transfer tokens from user if not ETH
        if (token != ethAddress) {
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }

        // Emit Deposited event
        emit Deposited(msg.sender, token, amount);
    }

    /// @inheritdoc IDigitalSafe
    function withdraw(address token, uint amount) external nonReentrant {
        if (amount == 0) {
            revert Errors.InvalidWithdrawAmount();
        }
        // Get user deposit struct
        Deposit storage _userDeposit = userDeposit[msg.sender][token];
        // Update user's available balance
        _updateOnWithdrawal(_userDeposit, amount);

        // Get total deposits for token
        Deposit storage _totalDeposit = totalDeposit[token];

        // Update total deposits struct for token
        _updateOnWithdrawal(_totalDeposit, amount);

        // withdraw token
        if (token == ethAddress) {
            (bool success, ) = address(msg.sender).call{value: amount}("");
            if (!success) {
                revert Errors.ETHTransferFailed();
            }
        } else {
            IERC20(token).safeTransfer(msg.sender, amount);
        }

        // Emit Withdrawal event
        emit Withdrawal(msg.sender, token, amount);
    }

    /// @inheritdoc IDigitalSafe
    function collectFees(
        address token,
        address receiver
    ) external onlyOwner nonReentrant {
        if (receiver == address(0)) {
            revert Errors.InvalidFeeCollectionAddress();
        }
        // Get total deposits for token
        Deposit storage _totalDeposit = totalDeposit[token];
        if(_totalDeposit.amount == 0) {
            revert Errors.NoDepositsForToken();
        }
        // Calculate fees accumulated for token
        uint96 accumulatedFee = FeeLib.calculateFeesSinceTimestamp(
            uint(_totalDeposit.timestamp),
            _totalDeposit.amount,
            feePerSecond
        );
        // Get total fees accumulated so far
        uint feeAmount = _totalDeposit.fee + accumulatedFee;
        // Update deposit struct
        _updateOnFeeCollection(_totalDeposit, accumulatedFee);

        // Transfer fees to receiver
        if (token == ethAddress) {
            (bool success, ) = address(receiver).call{value: feeAmount}("");
            if (!success) {
                revert Errors.ETHTransferFailed();
            }
        } else {
            IERC20(token).safeTransfer(receiver, feeAmount);
        }

        // Emit FeeCollected event
        emit FeeCollected(receiver, token, feeAmount);
    }

    /**
     * @notice Update the deposit struct on call to deposit with a given amount
     */
    function _updateOnDeposit(Deposit storage _deposit, uint amount) private {
        uint96 accumulatedFee = FeeLib.calculateFeesSinceTimestamp(
            uint(_deposit.timestamp),
            _deposit.amount,
            feePerSecond
        );
        // update the deposited amount
        _deposit.amount = FeeLib.getUpdatedAmountOnDeposit(
            _deposit.amount,
            amount,
            accumulatedFee
        );
        // update the accumulated fee
        _deposit.fee += accumulatedFee;
        // update the timestamp
        _deposit.timestamp = uint32(block.timestamp);
    }

    /**
     * @notice Update the deposit struct on call to withdraw with a given amount
     */
    function _updateOnWithdrawal(
        Deposit storage _deposit,
        uint amount
    ) private {
        uint96 accumulatedFee = FeeLib.calculateFeesSinceTimestamp(
            uint(_deposit.timestamp),
            _deposit.amount,
            feePerSecond
        );
        // Check if user has enough to withdraw
        if (_deposit.amount < amount + accumulatedFee) {
            revert Errors.InvalidWithdrawal();
        }
        // update the deposited amount
        _deposit.amount = FeeLib.getUpdatedAmountOnWithdrawal(
            _deposit.amount,
            amount,
            accumulatedFee
        );
        // update the accumulated fee
        _deposit.fee += accumulatedFee;
        // update the timestamp
        _deposit.timestamp = uint32(block.timestamp);
    }

    /**
     * @notice Update the deposit struct on call to collectFees
     * @dev Resets fees to 0 and subtracts fees from amount
     */
    function _updateOnFeeCollection(
        Deposit storage _deposit,
        uint accumulatedFee
    ) private {
        // update the total amount deposited for the token
        _deposit.amount = FeeLib.getUpdatedAmountOnFeeCollection(
            _deposit.amount,
            accumulatedFee
        );
        // reset fee amount
        _deposit.fee = 0;
        // update the timestamp
        _deposit.timestamp = uint32(block.timestamp);
    }
}
