# DumpEX v1

DumpEX is an exchange for ERC20 and ERC721 tokens guaranteeing a floor price regardless of market conditions. Users can purchase assets in a Dutch auction. Each purchase increases the asset price by a certain factor (1 ETH for NFTs and 0.0001 ETH for tokens). 

Sellers can sell assets to the exchange for a guaranteed price of 1 wei. If there has previously been a purchase from the contract, sellers can sell to the contract for the price of the previous purchase. In case of tokens, the maximum payout for sellers is the total amount paid by the previous purchaser. If the seller is selling fewer tokens than were previously purchased, the seller is compensated pro rata.

## Compiling &Testing
DumpEX uses hardhat with chai. You can compile DumpEX by running `npx hardhat compile`. Run the testing suite and gas reporting tools with `npx hardhat test`.