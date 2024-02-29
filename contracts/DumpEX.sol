// TODO: use decimals in token calculation
// TODO: Super simple UI for day 0 usage + some documentation

// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
//TODO_ENABLE import "contracts/imports/IBlast.sol";
//TODO_ENABLE import "contracts/imports/IBlasPoints.sol";


error NotEnoughEther();
error Payable(uint weiToPay);
error OnlyAdmin();

/// @title Dump Exchange v1 for Blast
/// @author Juuso Roinevirta
/// @notice Use this contract to sell NFTs & tokens at a fixed price & to buy them in a Dutch auction
/// @dev this contract has been modified for Blast such that the contract accrues yield on ETH and gas fees to self-finance its operations
/// @custom:experimental This is an experimental contract.
contract DumpEX {

    event TokenSold(address indexed seller, address tokenAddress, uint256 amount, uint256 price);   // price = total price
    event TokenBought(address indexed buyer, address tokenAddress, uint256 amount, uint256 price);  // price = total price
    event NftSold(address indexed seller, address nftAddress, uint256 tokenId, uint256 price);      // price = total price
    event NftBought(address indexed buyer, address nftAddress, uint256 tokenId, uint256 price);     // price = total price

    // Please note that block numbers are used as the timestamping mechanism
    struct Deal { 
        uint256 timestamp;
        uint256 price;  // total deal value
    }
    struct DealWithAmount { 
        uint256 timestamp;
        uint256 price;  // total deal value
        uint256 amount;
    }

    mapping(address => Deal) lastSaleNfts;                  // Timestamp + price at which NFT was last sold to contract
    mapping(address => Deal) lastPurchaseNfts;              // Timestamp + price at which NFT was last bought from contract
    mapping(address => Deal) lastSaleTokens;                // Timestamp + price at which token was last sold to contract
    mapping(address => DealWithAmount) lastPurchaseTokens;  // Timestamp + price + amount at which token was last bought from contract
    
    address public admin;
    address public pendingAdmin;
    //TODO_ENABLE IBlast public constant BLAST = IBlast(0x4300000000000000000000000000000000000002);  // TODO: Check mainnet address
    //TODO_ENABLE address BlastPointsAddressTestnet = 0x2fc95838c71e76ec69ff817983BFf17c710F34E0;   // TODO: Check mainnet address
    //TODO_ENABLE address _pointsOperator = ; // TODO: Set to hot EOA

    constructor() {
        admin = msg.sender;
        //TODO_ENABLE BLAST.configureAutomaticYield();
        //TODO_ENABLE BLAST.configureClaimableGas(); 
        //TODO_ENABLE IBlastPoints(BlastPointsAddressTestnet).configurePointsOperator(_pointsOperator);
    }

    //////////////////////
    // HELPER FUNCTIONS //
    //////////////////////

    /// @notice choose max
    function max(uint256 a, uint256 b) private pure returns (uint256) {
        return a >= b ? a : b;
    }

    /// @notice calculates the protocol fee for a given trade - larger of protocolFeePercentage or protocolFeeMinimimum
    /// @param payableAmount the amount that is to be paid for the asset(s)
    function _getProtocolFee(uint256 payableAmount) private pure returns (uint256) {
        uint256 protocolFeeMinimum = 100000000000000; // wei --> 0.0001 ETH
        uint256 protocolFeePercentage = 3;
        if (payableAmount * protocolFeePercentage > protocolFeeMinimum * 100) {     // percentage amount is higher
            return payableAmount * protocolFeePercentage / 100;
        } else {    // flat minimum fee is higher
            return protocolFeeMinimum;
        }
    }

    /// @notice calculates the current value based on a certain input values
    /// @param initialValue the initial value that is adjusted for decay
    /// @param n the number of periods 
    /// @param decayRate how many wei are deducted per period
    function _calculateDecay(uint256 initialValue, uint256 n, uint decayRate) private pure returns (uint256) {
        if (n * decayRate > initialValue) {
            return 1;
        } else {
            return (initialValue - (n * decayRate));
        }
    }

    /// @notice Internal method that returns the price for which a given NFT can be bought from inventory
    /// @param nftAddress address of the nft collection
    function _getNftBuyPrice(address nftAddress) private view returns(uint) {
        if (lastPurchaseNfts[nftAddress].timestamp == 0) { // NFT has never been bought
            uint blocksSinceLastAction = block.number - lastSaleNfts[nftAddress].timestamp;
            return _calculateDecay(1500 * 10e17, blocksSinceLastAction, 10**15);  // Use starting price of 1500 ETH, decays 0.001ETH per block
        } else {  // NFT has been bought before
            uint blocksSinceLastAction = block.number - lastPurchaseNfts[nftAddress].timestamp;
            uint decayedPrice = _calculateDecay(lastPurchaseNfts[nftAddress].price + 10e17, blocksSinceLastAction, 10**15);  // Add 1 ETH to price, decays 0.001ETH per block
            return max(decayedPrice, 1);
        } 
    }

    /// @notice Internal method that returns the price the contract is willing to pay for a given NFT
    /// @param nftAddress address of the nft collection
    function _getNftSellPrice(address nftAddress) private view returns(uint) {
        if (lastPurchaseNfts[nftAddress].timestamp > lastSaleNfts[nftAddress].timestamp) {  // Ensure that there's been a more recent purchase from the contract than a sale
            return lastPurchaseNfts[nftAddress].price; // We pay the price that was previously paid
        } else {    // If there have been no recent purchases
            return 1;    // We pay the fixed floor of 1 wei
        }
    }

    /// @notice Internal method that returns the total price for which a given number of token can be bought from inventory
    /// @param tokenAddress address of the token
    /// @param amount the amount of tokens that one wants to buy
    function _getTokenBuyPrice(address tokenAddress, uint256 amount) private view returns(uint) {
        if (lastPurchaseTokens[tokenAddress].timestamp == 0) {   // Tokens have never been bought
            uint blocksSinceLastAction = block.number - lastSaleTokens[tokenAddress].timestamp;
            return _calculateDecay(15 * amount / 10, blocksSinceLastAction, 10e11);  // Use starting price of 1.5 ETH, decays 0.000001ETH per block
        } else {   // Tokens have been bought at some point
            uint blocksSinceLastAction = block.number - lastPurchaseTokens[tokenAddress].timestamp;
            uint grossPrice = lastPurchaseTokens[tokenAddress].price * amount / lastPurchaseTokens[tokenAddress].amount;   // Use prev. buy price to determine price for this lot
            uint priceIncrease = amount / 10e2;    // Add 0.0001 ETH to price per token
            uint decayedPrice = _calculateDecay(grossPrice + priceIncrease, blocksSinceLastAction, 10e11);  // decays 0.000001ETH per block
            return max(decayedPrice, 1);    // Never sell for less than 1 wei
        } 
    }

    /// @notice Internal method that returns the price the contract is willing to pay for a given token
    /// @param tokenAddress address of the token
    /// @param amount the amount of tokens that one wants to sell
    function _getTokenSellPrice(address tokenAddress, uint256 amount) private view returns(uint) {
        if (lastPurchaseTokens[tokenAddress].timestamp > lastSaleTokens[tokenAddress].timestamp) {  // Ensure that there's been a more recent purchase from the contract than a sale
            if (lastPurchaseTokens[tokenAddress].amount >= amount) {    // We can pay the same price as the previous buyer paid if the amount of tokens are same or less than previously
                return lastPurchaseTokens[tokenAddress].price * amount / lastPurchaseTokens[tokenAddress].amount;  // We adjust such that per token value is same
            } else {    // If the seller is selling more, then we won't pay more to prevent draining
                return lastPurchaseTokens[tokenAddress].price; // We pay the price that was previously paid for less tokens
            }
        } else {    // If there have been no recent purchases
            return 1;    // We pay the fixed floor of 1 wei
        }
    }

    ////////////////////
    // USER FUNCTIONS //
    ////////////////////

    /// @notice Sell an NFT
    /// @dev There must be an existing approval and some wei in the contract. Payment is sent to caller.
    /// @param nftAddress the address of the NFT you are selling
    /// @param tokenId the ID of the NFT you are selling
    function sellNft(address nftAddress, uint256 tokenId) external {
        IERC721 nft = IERC721(nftAddress);

        // requirements
        if (nft.getApproved(tokenId) != address(this)) { revert ("Not approved"); }

        // transfer the NFT to the pool
        nft.transferFrom(msg.sender, address(this), tokenId);

        // get price
        uint price = _getNftSellPrice(nftAddress);
        if (address(this).balance < price) { revert NotEnoughEther(); }

        // transfer the payment
        (bool success, ) = payable(msg.sender).call{value: price}("");
        require(success, "Transfer failed.");

        // update last NFT sale data
        lastSaleNfts[nftAddress] = Deal(block.number, price);

        emit NftSold(msg.sender, nftAddress, tokenId, price);
    }

    /// @notice Sell a collection of NFTs
    /// @dev There must be an existing approval and some wei in the contract. Payment is sent to caller.
    /// @param nftAddress the address of the NFT you are selling
    /// @param tokenIds the IDs of the NFTs you are selling
    function multisellNft(address nftAddress, uint256[] calldata tokenIds) external {
        IERC721 nft = IERC721(nftAddress);

        // get current price of the NFT
        uint itemsToSell = tokenIds.length;
        uint price = _getNftSellPrice(nftAddress);

        // requirements
        if (address(this).balance < price) { revert NotEnoughEther(); }

        // transfer the NFT to the pool
        for (uint256 i = 0; i < itemsToSell; ++i) {
            if (nft.getApproved(tokenIds[i]) != address(this)) { revert ("Not approved"); }
            nft.transferFrom(msg.sender, address(this), tokenIds[i]);
            emit NftSold(msg.sender, nftAddress, tokenIds[i], price);
        }

        // transfer the payment
        (bool success, ) = payable(msg.sender).call{value: price}("");
        require(success, "Transfer failed.");

        // update last NFT sale data
        lastSaleNfts[nftAddress] = Deal(block.number, price);
    }

    /// @notice Buy an NFT at a price determined by a Dutch auction
    /// @param nftAddress the address of the NFT you are buying
    /// @param tokenId the ID of the NFT you are buying
    function buyNft(address nftAddress, uint256 tokenId) external payable {
        IERC721 nft = IERC721(nftAddress);

        // get current price of the NFT
        uint buyPrice = _getNftBuyPrice(nftAddress);
        uint protocolFee = _getProtocolFee(buyPrice);

        // requirements
        if (msg.value < buyPrice + protocolFee) { revert Payable(buyPrice + protocolFee); }

        // transfer NFT to buyer
        nft.safeTransferFrom(address(this), msg.sender, tokenId);

        // transfer protocol fee to current admin
        payable(admin).transfer(protocolFee);

        // update NFT purchase data
        lastPurchaseNfts[nftAddress] = Deal(block.number, buyPrice);

        emit NftBought(msg.sender, nftAddress, tokenId, buyPrice);
    }

    /// @notice Buy multiple NFTs from a single collection without resetting the price ("sweep inventory")
    /// @param nftAddress the address of the NFT collection you are buying
    /// @param tokenIds the IDs of the NFT you are buying
    function multibuyNft(address nftAddress, uint256[] calldata tokenIds) external payable {
        IERC721 nft = IERC721(nftAddress);

        // get current price of the NFT
        uint itemsToBuy = tokenIds.length;
        uint buyPrice = _getNftBuyPrice(nftAddress) * itemsToBuy;
        uint protocolFee = _getProtocolFee(buyPrice);

        // requirements
        if (msg.value < buyPrice + protocolFee) { revert Payable(buyPrice + protocolFee); }

        // transfer NFTs to buyer
        for (uint256 i = 0; i < itemsToBuy; ++i) {
            nft.safeTransferFrom(address(this), msg.sender, tokenIds[i]);
            emit NftBought(msg.sender, nftAddress, tokenIds[i], buyPrice);
        }

        // transfer protocol fee to current admin
        payable(admin).transfer(protocolFee);

        // update NFT purchase data
        lastPurchaseNfts[nftAddress] = Deal(block.number, buyPrice);
    }

    /// @notice Get the price to pay for a given NFT
    /// @param nftAddress the address of the NFT collection
    function getNftBuyPrice(address nftAddress) external view returns(uint) {
        return _getNftBuyPrice(nftAddress);
    }

    /// @notice Returns the total fee the protocol charges for a purchase of a certain size
    /// @param payableAmount the value of the purchase prior to fees
    function getProtocolFee(uint256 payableAmount) external pure returns (uint256) {
        return _getProtocolFee(payableAmount);
    }

    /// @notice Get the price to pay for a given NFT
    /// @param nftAddress the address of the NFT collection
    function getNftNetBuyPrice(address nftAddress) external view returns(uint) {
        uint grossPrice = _getNftBuyPrice(nftAddress);
        return grossPrice + _getProtocolFee(grossPrice);
    }

    /// @notice Get the current price the contract pays for a given NFT
    /// @param nftAddress the address of the NFT collection
    function getNftSellPrice(address nftAddress) external view returns(uint) {
        return _getNftSellPrice(nftAddress);
    }

    /// @notice Sell token(s) for fixed price or best possible price
    /// @dev There must be an existing approval and some wei in the contract. Payment is sent to caller.
    /// @param tokenAddress address of the token you are selling
    /// @param amount number of tokens to sell
    function sellToken(address tokenAddress, uint256 amount) external {
        IERC20 token = IERC20(tokenAddress);

        // requirements
        if (token.allowance(msg.sender, address(this)) < amount) { revert ("Allowance is not sufficient"); }

        // transfer Tokens to the pool
        token.transferFrom(msg.sender, address(this), amount);

        // transfer Ether to the seller        
        uint sellPrice = _getTokenSellPrice(tokenAddress, amount);
        if (address(this).balance < sellPrice) { revert NotEnoughEther(); }
        payable(msg.sender).transfer(sellPrice);

        // update last Token sale data
        lastSaleTokens[tokenAddress] = Deal(block.number, sellPrice);

        emit TokenSold(msg.sender, tokenAddress, amount, sellPrice);
    }

    /// @notice Buy tokens at a price determined by a Dutch auction
    /// @param tokenAddress address of the token you are buying
    /// @param amount number of tokens to buy
    function buyToken(address tokenAddress, uint256 amount) external payable {
        IERC20 token = IERC20(tokenAddress);

        //get current price of Tokens
        uint buyPrice = _getTokenBuyPrice(tokenAddress, amount);
        uint protocolFee = _getProtocolFee(buyPrice);
        uint netPrice = buyPrice + protocolFee;

        // requirements
        if (msg.value < netPrice) { revert Payable(netPrice); }

        // transfer Tokens to the buyer
        token.transfer(msg.sender, amount);

        // transfer protocol fee to current admin
        payable(admin).transfer(protocolFee);

        // set new purchase price
        lastPurchaseTokens[tokenAddress] = DealWithAmount(block.number, buyPrice, amount);

        emit TokenBought(msg.sender, tokenAddress, amount, buyPrice);
    }

    /// @notice Get the price to pay for a given token
    /// @param tokenAddress the address of the token
    /// @param amount the amount of tokens to buy
    function getTokenBuyPrice(address tokenAddress, uint256 amount) external view returns(uint) {
        return _getTokenBuyPrice(tokenAddress, amount);
    }

    /// @notice Get the price to pay for a given token
    /// @param tokenAddress the address of the token
    /// @param amount the amount of tokens to buy
    function getTokenNetBuyPrice(address tokenAddress, uint256 amount) external view returns(uint) {
        uint grossPrice = _getTokenBuyPrice(tokenAddress, amount);
        return grossPrice + _getProtocolFee(grossPrice);
    }

    /// @notice Get the current price the contract pays for a given token
    /// @param tokenAddress the address of the token
    /// @param amount the amount of tokens to sell
    function getTokenSellPrice(address tokenAddress, uint256 amount) external view returns(uint) {
        return _getTokenSellPrice(tokenAddress, amount);
    }

    receive() external payable {}

    //////////////////////
    /// ADMIN FUNCTIONS //
    //////////////////////

    /// @notice Withdraw Ether from the contract to the admin
    /// @param amount wei
    function adminWithdrawEther(uint256 amount) external {
        if (amount > address(this).balance - 100) { revert ("Withdrawing too much"); } 
        payable(admin).transfer(amount);
    }

    /// @notice Only admin: set a new admin
    /// @param newAdmin address of the new admin
    function setAdmin(address newAdmin) external {
        if (msg.sender != admin) { revert OnlyAdmin(); }
        pendingAdmin = newAdmin;
    }

    /// @notice Pending admin only: accept new admin
    function acceptAdmin() external {
        if (msg.sender != pendingAdmin) { revert ("Not pending admin"); }
        admin = pendingAdmin;
    }

    /// @notice Claim gas back to the contract
    /// @dev Method for claiming sequencer revenue into the contract for self-financing of operations
    //TODO_ENABLE function claimMyContractsGas() external {
    //TODO_ENABLE     BLAST.claimAllGas(address(this), address(this));
    //TODO_ENABLE }
}