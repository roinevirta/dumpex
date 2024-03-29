# DumpEX v1

DumpEX is an exchange for ERC20 and ERC721 tokens guaranteeing a floor price regardless of market conditions. Users can purchase assets in a Dutch auction. Each purchase increases the asset price by a certain factor (1 ETH for NFTs and 0.0001 ETH for tokens). 

Sellers can sell assets to the exchange for a guaranteed price of 1 wei. If there has previously been a purchase from the contract, sellers can sell to the contract for the price of the previous purchase. In case of tokens, the maximum payout for sellers is the total amount paid by the previous purchaser. If the seller is selling fewer tokens than were previously purchased, the seller is compensated pro rata.

## Compiling &Testing
DumpEX uses hardhat with chai. You can compile DumpEX by running `npx hardhat compile`. Run the testing suite and gas reporting tools with `npx hardhat test`.

## Deployed contract addresses
| Chain ID   | Network          | Contract address                             | Explorer | 
| ---------- | ---------------- | -------------------------------------------- | -------- |
| 42161      | Arbitrum One     | `0xa570f965681d15a2b760adda2693d624295221d4` | [Arbiscan.io](https://arbiscan.io/address/0xa570f965681d15a2b760adda2693d624295221d4)
| 43114      | Avalanche (C)    | `0xAB6aab4eb37fa4309cF22E6E65a16426fDd8E4C7` | [Avascan.info](https://avascan.info/blockchain/c/address/0xAB6aab4eb37fa4309cF22E6E65a16426fDd8E4C7)
| 8453       | Base             | `0xab6aab4eb37fa4309cf22e6e65a16426fdd8e4c7` | [Basescan.io](https://basescan.org/address/0xab6aab4eb37fa4309cf22e6e65a16426fdd8e4c7)
| 81457      | Blast            | `0x0297697af2c3616d78cb7a3ad8d15acf8f9b6711` | [Blastscan.io](https://blastscan.io/address/0x0297697af2c3616d78cb7a3ad8d15acf8f9b6711)
| 168587773  | Blast Sepolia    | `0x76115Df0b591e22DfBD1F737bCCb7dbc2dED7567` | [Blastscan.io](https://testnet.blastscan.io/address/0x76115Df0b591e22DfBD1F737bCCb7dbc2dED7567)
| 56         | BNB Smart Chain  | `0xAB6aab4eb37fa4309cF22E6E65a16426fDd8E4C7` | [Bsctrace.com](https://bsctrace.com/address/0xAB6aab4eb37fa4309cF22E6E65a16426fDd8E4C7)
| 25         | Cronos           | `TBD` | [Cronoscan.com](https://cronoscan.com/)
| 1          | Ethereum         | `0xbc06b693a1b6a02739ea7c6b3d3660bcea3fd186` | [Etherscan.io](https://etherscan.io/address/0xbc06b693a1b6a02739ea7c6b3d3660bcea3fd186)
| 250        | Fantom           | `0xab6aab4eb37fa4309cf22e6e65a16426fdd8e4c7` | [ftmscan.com](https://ftmscan.com/address/0xab6aab4eb37fa4309cf22e6e65a16426fdd8e4c7)
| 100        | Gnosis           | `0x35629b4749e0bf0396a11bd626ced54c6a4c2f55` | [Gnosisscan.io](https://gnosisscan.io/address/0x35629b4749e0bf0396a11bd626ced54c6a4c2f55)
| 59144      | Linea            | `0xffadfa2855513f353b10cbbaad23c7d8dba5a068` | [Lineascan.build](https://lineascan.build/address/0xffadfa2855513f353b10cbbaad23c7d8dba5a068)
| 10         | Optimism         | `0x404df8bc73d3632338c4e43c4971bf469a849d79` | [Etherscan.io](https://optimistic.etherscan.io/address/0x404df8bc73d3632338c4e43c4971bf469a849d79)
| 137        | Polygon          | `0xab6aab4eb37fa4309cf22e6e65a16426fdd8e4c7` | [Polygonscan.com](https://polygonscan.com/address/0xab6aab4eb37fa4309cf22e6e65a16426fdd8e4c7)