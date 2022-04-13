// SPDX-License-Identifier: MIT
pragma solidity 0.7.5;
pragma abicoder v2;

contract StressTest {
    uint256 countNumber;

    receive() external payable {}

    struct testAccounts {
        address payable testAccount;
    }

    event AddNumber(uint256);

    function addNumber() public {
        countNumber++;
        emit AddNumber(countNumber);
    }

    function addETH(testAccounts[] calldata accounts) public {
        for (uint256 i = 0; i < accounts.length; i++) {
            address targetAccount = accounts[i].testAccount;
            (bool sent, ) = targetAccount.call{value: 2e15}("");
            require(sent, "Failed to send ETH");
        }
    }
}