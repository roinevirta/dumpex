const { expect } = require("chai");
const { ethers } = require("hardhat");
const { mine } = require("@nomicfoundation/hardhat-network-helpers");

describe("DumpEX Contract Tests", function () {
    let dumpEx;
    let mockERC20;
    let mockERC721;
    let owner, user1, user2;

    before(async function () {
        [owner, user1, user2] = await ethers.getSigners();
        // Deploy MockERC20 and MockERC721 tokens using the Hardhat environment
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        mockERC20 = await MockERC20.deploy("MockToken", "MTK");
        mockERC20.waitForDeployment();
    
        const MockERC721 = await ethers.getContractFactory("MockERC721");
        mockERC721 = await MockERC721.deploy("MockNFT", "MNFT");
        mockERC721.waitForDeployment();
    
        // Deploy the main contract
        const DumpEX = await ethers.getContractFactory("DumpEX");
        dumpEx = await DumpEX.deploy();
        dumpEx.waitForDeployment();

        // Put 1 ETH into the contract
        await owner.sendTransaction({
            to: owner.address,
            value: ethers.parseEther("10") // Send 10 ETH to owner
        });
        await owner.sendTransaction({
            to: dumpEx.getAddress(),
            value: ethers.parseEther("1") // Send 1 ETH to dumpex
        });
    });

    describe("Pricing", function () {
        it("Initial token price is correct", async function () {
            const sellAmount = ethers.parseUnits("100", 18);
            await mockERC20.mint(user1.address, sellAmount);
            await mockERC20.connect(user1).approve(dumpEx.getAddress(), sellAmount);
                        
            const userOldEthBalance = await ethers.provider.getBalance(user1.address);
            
            // Perform the sell operation and capture the transaction receipt
            const tx = await dumpEx.connect(user1).sellToken(mockERC20.getAddress(), sellAmount);
            const receipt = await tx.wait(); // Wait for the transaction to be mined to get the receipt
            
            // Calculate gas cost
            const gasUsed = receipt.gasUsed; // BigNumber of the gas used for the transaction
            const txDetails = await ethers.provider.getTransaction(tx.hash);
            const gasPrice = txDetails.gasPrice; // BigNumber of the gas price
            const gasCost = gasUsed * gasPrice; // Total gas cost
            
            const userNewEthBalance = await ethers.provider.getBalance(user1.address);
            
            // Calculate the net balance change, accounting for gas cost
            const userBalanceChange = userNewEthBalance + gasCost - userOldEthBalance; // Add back the gasCost since it's an expense
            expect(userBalanceChange).to.equal(ethers.parseEther("0.000000000000000001")); // User should receive 1 wei, accounting for gas
            
            const totalPrice = await dumpEx.connect(user1).getTokenBuyPrice(mockERC20.getAddress(), sellAmount);
            expect(totalPrice).to.equal(ethers.parseEther("1.5") * 100n);   // CORRECT BUY PRICE – Starting price for tokens is 1.5ETH

            const netPrice = await dumpEx.connect(user1).getTokenNetBuyPrice(mockERC20.getAddress(), sellAmount);
            expect(netPrice).to.equal(ethers.parseEther("1.545") * 100n);   // CORRECT BUY PRICE – Starting price for tokens is 1.5ETH
        });
        
        it("Token price is correct after 1 block", async function () {
            const sellAmount = ethers.parseUnits("1", 18);
            await mockERC20.mint(user1.address, sellAmount);
            await mockERC20.connect(user1).approve(dumpEx.getAddress(), sellAmount);

            const userOldEthBalance = await ethers.provider.getBalance(user1.address);

            // Perform the sell operation and capture the transaction receipt
            const tx = await dumpEx.connect(user1).sellToken(mockERC20.getAddress(), sellAmount);
            const receipt = await tx.wait(); // Wait for the transaction to be mined to get the receipt

            // Calculate gas cost
            const gasUsed = receipt.gasUsed; // BigNumber of the gas used for the transaction
            const txDetails = await ethers.provider.getTransaction(tx.hash);
            const gasPrice = txDetails.gasPrice; // BigNumber of the gas price
            const gasCost = gasUsed * gasPrice; // Total gas cost

            const userNewEthBalance = await ethers.provider.getBalance(user1.address);

            // Calculate the net balance change, accounting for gas cost
            const userBalanceChange = userNewEthBalance + gasCost - userOldEthBalance; // Add back the gasCost since it's an expense
            expect(userBalanceChange).to.equal(ethers.parseEther("0.000000000000000001")); // User should receive 1 wei, accounting for gas

            await mine(1);

            const totalPrice = await dumpEx.connect(user1).getTokenBuyPrice(mockERC20.getAddress(), sellAmount);
            const expectedPrice = ethers.parseEther("1.499999000000000000"); // 1.5ETH - 0.000001ETH
        
            expect(totalPrice).to.equal(expectedPrice); // CORRECT BUY PRICE 
        });

        it("Token decimals are handled correctly in purchases", async function () {
            const Dec6ERC20 = await ethers.getContractFactory("MockERC20decimals");
            const dec6ERC20 = await Dec6ERC20.deploy("6 decimal token", "6DT", 6);
            dec6ERC20.waitForDeployment();

            const Dec18ERC20 = await ethers.getContractFactory("MockERC20decimals");
            const dec18ERC20 = await Dec18ERC20.deploy("18 decimal token", "18DT", 18);
            dec18ERC20.waitForDeployment();

            const amount6decimals = ethers.parseUnits("100", 6); // 100 tokens
            const amount18decimals = ethers.parseUnits("100", 18); // 100 tokens

            await dec6ERC20.mint(user1.address, amount6decimals);
            await dec6ERC20.connect(user1).approve(dumpEx.getAddress(), amount6decimals);
            await dumpEx.connect(user1).sellToken(dec6ERC20.getAddress(), amount6decimals)
            const grossPrice6dec = await dumpEx.connect(user1).getTokenBuyPrice(dec6ERC20.getAddress(), amount6decimals);
            const expectedPrice6Base = ethers.parseUnits("1.5", 6);
            const expectedPrice6dec = expectedPrice6Base * (100n);      // Starting price should be 100 * 1.5 ETH / 10e12
            expect(grossPrice6dec.toString()).to.equal(expectedPrice6dec.toString()); // CORRECT BUY PRICE 

            await dec18ERC20.mint(user1.address, amount18decimals);
            await dec18ERC20.connect(user1).approve(dumpEx.getAddress(), amount18decimals);
            await dumpEx.connect(user1).sellToken(dec18ERC20.getAddress(), amount18decimals)            
            const grossPrice18dec = await dumpEx.connect(user1).getTokenBuyPrice(dec18ERC20.getAddress(), amount18decimals);
            const expectedPrice18Base = ethers.parseUnits("1.5", 18);
            const expectedPrice18dec = expectedPrice18Base * (100n);    // Starting price should be 100 * 1.5 ETH
            expect(grossPrice18dec.toString()).to.equal(expectedPrice18dec.toString()); // CORRECT BUY PRICE 
        });

        it("Initial NFT price is correct", async function () {
            const tokenId = 1;
            await mockERC721.mint(user1.address, tokenId);
            await mockERC721.connect(user1).approve(dumpEx.getAddress(), tokenId);
            await dumpEx.connect(user1).sellNFT(mockERC721.getAddress(), tokenId);
        
            const nftPrice = await dumpEx.connect(user1).getNftBuyPrice(mockERC721.getAddress());
            expect(nftPrice).to.equal(ethers.parseEther("1500")); // Starting price for NFTs is 1500 ETH

            const nftPriceNetFees = await dumpEx.connect(user1).getNftNetBuyPrice(mockERC721.getAddress());
            expect(nftPriceNetFees).to.equal(ethers.parseEther("1545")); // Add 3% fee
        });

        it("NFT price is correct after 1 block", async function () {
            const tokenId = 2;
            await mockERC721.mint(user1.address, tokenId);
            await mockERC721.connect(user1).approve(dumpEx.getAddress(), tokenId);
            await dumpEx.connect(user1).sellNFT(mockERC721.getAddress(), tokenId);
        
            await mine(1);
        
            const nftPriceAfterOneBlock = await dumpEx.connect(user1).getNftBuyPrice(mockERC721.getAddress());
            const expectedPriceAfterDecay = ethers.parseEther("1500") - ethers.parseEther("0.001"); // 1500 ETH - decay
        
            expect(nftPriceAfterOneBlock.toString()).to.equal(expectedPriceAfterDecay.toString()); // Checking the price after decay
        });
                
    });

    describe("Token Transactions", function () {

        it("Tokens can be sold to the contract", async function () {
            const oldContractBalance = await mockERC20.balanceOf(dumpEx.getAddress());
            const sellAmount = ethers.parseUnits("100", 18);
            await mockERC20.mint(user1.address, sellAmount);
            await mockERC20.connect(user1).approve(dumpEx.getAddress(), sellAmount);
            await mockERC20.connect(user1).transfer(user1.address, sellAmount); // Ensure user1 has tokens to sell

            // User1 sells tokens to the contract
            await expect(dumpEx.connect(user1).sellToken(mockERC20.getAddress(), sellAmount))
                .to.emit(dumpEx, 'TokenSold')
                .withArgs(user1.address, mockERC20.getAddress(), sellAmount, 1);

            // Check user1's token balance decreased and contract's token balance increased
            const user1Balance = await mockERC20.balanceOf(user1.address);
            const contractBalance = await mockERC20.balanceOf(dumpEx.getAddress());
            const actualBalanceChange = contractBalance - oldContractBalance;
            expect(user1Balance).to.equal(0);
            expect(actualBalanceChange).to.equal(sellAmount);
        });

        it("Tokens can be bought from the contract", async function () {
            await user1.sendTransaction({
                to: user1.address,
                value: ethers.parseEther("100") // Send 100 ETH to user1
              });
              
            // Skip some blocks to come to a lower price
            await mine(10000000);

            // Get token price
            const buyAmount = ethers.parseUnits("50", 18);
            const grossCost = await dumpEx.connect(user1).getTokenBuyPrice(mockERC20.getAddress(), buyAmount);
            const totalCost = await dumpEx.connect(user1).getTokenNetBuyPrice(mockERC20.getAddress(), buyAmount);

            const adjustedGrossCost = grossCost - ethers.parseEther("0.000001"); // for some reason 1 block passes
        
            // User1 buys tokens from the contract
            await expect(dumpEx.connect(user1).buyToken(mockERC20.getAddress(), buyAmount, { value: totalCost }))
                .to.emit(dumpEx, 'TokenBought')
                .withArgs(user1.address, mockERC20.getAddress(), buyAmount, adjustedGrossCost);
            
            // Check user1's token balance increased
            const user1Balance = await mockERC20.balanceOf(user1.address);
            expect(user1Balance).to.equal(buyAmount);
        });

        it("Token pricing is correct after a purchase", async function () {
            await owner.sendTransaction({
                to: user2.address,
                value: ethers.parseEther("100") // Sending enough ETH to user2 for the purchase
            });


            const amount = ethers.parseEther("0.1");

            // Reset purchase price
            const tokenNetPriceReset = await dumpEx.connect(user2).getTokenNetBuyPrice(mockERC20.getAddress(), amount);
            await dumpEx.connect(user2).buyToken(mockERC20.getAddress(), amount, { value: tokenNetPriceReset })

            await mine(1);

            const priceBeforeBuy = await dumpEx.connect(user2).getTokenBuyPrice(mockERC20.getAddress(), amount);
        
            // User2 buys the token from the contract
            const tokenNetPrice = await dumpEx.connect(user2).getTokenNetBuyPrice(mockERC20.getAddress(), amount);
            await dumpEx.connect(user2).buyToken(mockERC20.getAddress(), amount, { value: tokenNetPrice })
            const priceAfterBuy = await dumpEx.connect(user2).getTokenBuyPrice(mockERC20.getAddress(), amount);

            const priceDecreasePerBlock = ethers.parseEther("0.000001");
            const priceIncreaseFromTokenPurchase = ethers.parseEther("0.0001");
            expect(priceIncreaseFromTokenPurchase).to.equal(priceAfterBuy - priceBeforeBuy + priceDecreasePerBlock);    

        });
    });

    describe("NFT Transactions", function () {
        it("NFTs can be sold to the contract", async function () {
            const tokenId = 10;
            await mockERC721.mint(user1.address, tokenId); // Mint NFT to user1
            await mockERC721.connect(user1).approve(dumpEx.getAddress(), tokenId); // user1 approves DumpEX contract
            
            // Ensure user1 sells the NFT to the contract
            await expect(dumpEx.connect(user1).sellNFT(mockERC721.getAddress(), tokenId))
                .to.emit(dumpEx, 'NFTSold')
                .withArgs(user1.address, mockERC721.getAddress(), tokenId, 1);
            
            // Verify ownership transfer
            const ownerOfNFT = await mockERC721.ownerOf(tokenId);
            expect(ownerOfNFT).to.equal(await dumpEx.getAddress());
        });
        
        it("NFTs can be bought from the contract", async function () {
            await owner.sendTransaction({
                to: user2.address,
                value: ethers.parseEther("1600") // Sending enough ETH to user2 for the purchase
            });

            const tokenId = 20;
            await mockERC721.mint(dumpEx.getAddress(), tokenId); // Mint NFT to dumpex

            const nftNetPrice = await dumpEx.connect(user2).getNftNetBuyPrice(mockERC721.getAddress());
            const nftPrice = await dumpEx.connect(user2).getNftBuyPrice(mockERC721.getAddress());

            const adjustedPrice = nftPrice - ethers.parseEther("0.001"); // for some reason 1 block passes
        
            // User2 buys the NFT from the contract
            await expect(dumpEx.connect(user2).buyNFT(mockERC721.getAddress(), tokenId, { value: nftNetPrice }))
                .to.emit(dumpEx, 'NFTBought')
                .withArgs(user2.address, mockERC721.getAddress(), tokenId, adjustedPrice);
        
            // Check ownership of the NFT is transferred to user2
            expect(await mockERC721.ownerOf(tokenId)).to.equal(user2.address);
        });

        it("NFTs pricing is correct after a purchase", async function () {
            await owner.sendTransaction({
                to: user2.address,
                value: ethers.parseEther("10") // Sending enough ETH to user2 for the purchase
            });

            const tokenId = 78;
            await mockERC721.mint(dumpEx.getAddress(), tokenId); // Mint NFT to dumpex
            await mine(1400000);

            const priceBeforeBuy = await dumpEx.connect(user2).getNftBuyPrice(mockERC721.getAddress());
        
            // User2 buys the NFT from the contract
            const nftNetPrice = await dumpEx.connect(user2).getNftNetBuyPrice(mockERC721.getAddress());
            await dumpEx.connect(user2).buyNFT(mockERC721.getAddress(), tokenId, { value: nftNetPrice })

            const priceAfterBuy = await dumpEx.connect(user2).getNftBuyPrice(mockERC721.getAddress());

            expect(priceBeforeBuy).to.equal(priceAfterBuy - ethers.parseEther("1") + ethers.parseEther("0.001"));    // NFT price increases by 1 ETH after purchase
            // Last adjustment is due to a block passing 
        });
        
        it("Multiple NFTs can be bought from the contract", async function () {
            const tokenIds = [223, 224, 225];
            await Promise.all(tokenIds.map(async (id) => {
                await mockERC721.mint(dumpEx.getAddress(), id);
            }));
            
            // Calculate total cost by summing up individual costs
            const prices = await Promise.all(tokenIds.map(id => dumpEx.connect(user1).getNftNetBuyPrice(mockERC721.getAddress())));
            const totalCost = prices.reduce((acc, price) => acc + price, 0n);

            await dumpEx.connect(user1).multibuyNFT(mockERC721.getAddress(), tokenIds, { value: totalCost });
    
            // Verify each NFT ownership
            await Promise.all(tokenIds.map(async (id) => {
                expect(await mockERC721.ownerOf(id)).to.equal(user1.address);
            }));
        });
    });

    describe("Edge Cases", function () {
        it("A large amount of tokens can be sold", async function () {
            const EdgeERC20 = await ethers.getContractFactory("MockERC20");
            const edgeERC20 = await EdgeERC20.deploy("EdgeToken", "ETK");

            const sellAmount = ethers.parseUnits("1000000000000000", 18); // 1 quadrillion
            await edgeERC20.mint(user1.address, sellAmount);
            await edgeERC20.connect(user1).approve(dumpEx.getAddress(), sellAmount);
            await edgeERC20.connect(user1).transfer(user1.address, sellAmount); // Ensure user1 has tokens to sell

            // User1 sells tokens to the contract
            await expect(dumpEx.connect(user1).sellToken(edgeERC20.getAddress(), sellAmount))
                .to.emit(dumpEx, 'TokenSold')
                .withArgs(user1.address, edgeERC20.getAddress(), sellAmount, 1);
        });

        it("A small amount of tokens can be sold and bought", async function () {
            const EdgeERC20 = await ethers.getContractFactory("MockERC20");
            const edgeERC20 = await EdgeERC20.deploy("EdgeToken", "ETK");

            const sellAmount = ethers.parseUnits("1", 1); // 1 single token decimal
            const buyAmount = sellAmount;
            await edgeERC20.mint(user1.address, sellAmount);
            await edgeERC20.connect(user1).approve(dumpEx.getAddress(), sellAmount);
            await edgeERC20.connect(user1).transfer(user1.address, sellAmount); // Ensure user1 has tokens to sell

            // User1 sells tokens to the contract
            await expect(dumpEx.connect(user1).sellToken(edgeERC20.getAddress(), sellAmount))
                .to.emit(dumpEx, 'TokenSold')
                .withArgs(user1.address, edgeERC20.getAddress(), sellAmount, 1);

            await user2.sendTransaction({
                to: user2.address,
                value: ethers.parseEther("10") // Send ETH to user2
                });
    
            const buyPrice = await dumpEx.getTokenNetBuyPrice(edgeERC20.getAddress(), buyAmount);
            await expect(dumpEx.connect(user2).buyToken(edgeERC20.getAddress(), buyAmount, { value: buyPrice }))
                .to.emit(dumpEx, 'TokenBought')
                .withArgs(user2.address, edgeERC20.getAddress(), buyAmount, 1);
            });

        it("Ultimate token price is 1 wei", async function () {
            const EdgeERC20 = await ethers.getContractFactory("MockERC20");
            const edgeERC20 = await EdgeERC20.deploy("EdgeToken", "ETK");

            const amount = ethers.parseUnits("1", 18); // 1 single token decimal
            await edgeERC20.mint(user1.address, amount);
            await edgeERC20.connect(user1).approve(dumpEx.getAddress(), amount);
            await edgeERC20.connect(user1).transfer(user1.address, amount); // Ensure user1 has tokens to sell

            // User1 sells tokens to the contract
            await dumpEx.connect(user1).sellToken(edgeERC20.getAddress(), amount);

            await mine(200000000);
            const ultimatePrice = await dumpEx.connect(user1).getTokenBuyPrice(edgeERC20.getAddress(), amount);

            expect(ultimatePrice).to.equal(1);
        });

        it("Ultimate NFT price is 1 wei", async function () {
            const EdgeERC20 = await ethers.getContractFactory("MockERC20");
            const edgeERC20 = await EdgeERC20.deploy("EdgeToken", "ETK");

            const amount = ethers.parseUnits("1", 18); // 1 single token decimal
            await edgeERC20.mint(user1.address, amount);
            await edgeERC20.connect(user1).approve(dumpEx.getAddress(), amount);
            await edgeERC20.connect(user1).transfer(user1.address, amount); // Ensure user1 has tokens to sell

            // User1 sells tokens to the contract
            await dumpEx.connect(user1).sellToken(edgeERC20.getAddress(), amount);

            await mine(200000000);
            const ultimatePrice = await dumpEx.connect(user1).getTokenBuyPrice(edgeERC20.getAddress(), amount);

            expect(ultimatePrice).to.equal(1);
        });
        
        it("Ultimate NFT price is 1 wei", async function () {
            const EdgeERC721 = await ethers.getContractFactory("MockERC721");
            const edgeERC721 = await EdgeERC721.deploy("EdgeNFT", "ENFT");

            const tokenId = 396;
            await edgeERC721.mint(user1.address, tokenId);
            await edgeERC721.connect(user1).approve(dumpEx.getAddress(), tokenId);

            // User1 sells tokens to the contract
            await dumpEx.connect(user1).sellNFT(edgeERC721.getAddress(), tokenId);

            await mine(200000000);
            const ultimatePrice = await dumpEx.connect(user1).getNftBuyPrice(edgeERC721.getAddress());

            expect(ultimatePrice).to.equal(1);
        });
    });

    describe("Exploit Tests", function () {
        it("Sending a new token to contract does not allow extracting value", async function () {
            const OtherERC20 = await ethers.getContractFactory("MockERC20");
            const otherERC20 = await OtherERC20.deploy("OtherToken", "OTK");
        
            // Mint and send OtherERC20 tokens to DumpEx contract
            await otherERC20.mint(dumpEx.getAddress(), ethers.parseUnits("1000", 18));
            await otherERC20.mint(user1.address, ethers.parseUnits("1000", 18));
            await otherERC20.connect(user1).approve(dumpEx.getAddress(), ethers.parseUnits("10", 18));
        
            // Attempt to sell OtherERC20 tokens to DumpEx, expecting 1 wei apyment
            await expect(dumpEx.connect(user1).sellToken(otherERC20.getAddress(), ethers.parseUnits("10", 18)))
                .to.emit(dumpEx, 'TokenSold')
                .withArgs(user1.address, otherERC20.getAddress(), ethers.parseUnits("10", 18), 1);
        });
        
        it("Sending a new NFT to contract does not allow extracting value", async function () {
            const OtherERC721 = await ethers.getContractFactory("MockERC721");
            const otherERC721 = await OtherERC721.deploy("OtherNFT", "ONFT");

            // MInt and send
            await otherERC721.mint(dumpEx.getAddress(), 1);
            await otherERC721.mint(user1.address, 2);
            await otherERC721.connect(user1).approve(dumpEx.getAddress(), 2);
        
            // Attempt to sell OtherERC20 tokens to DumpEx, expecting 1 wei apyment
            await expect(dumpEx.connect(user1).sellNFT(otherERC721.getAddress(), 2))
                .to.emit(dumpEx, 'NFTSold')
                .withArgs(user1.address, otherERC721.getAddress(), 2, 1);
        });

        it("Sending an existing token to contract does not allow extracting value", async function () {
            const sellAmount = ethers.parseUnits("100", 18);
            const halfAmount = ethers.parseUnits("50", 18);
            await mockERC20.mint(user1.address, sellAmount);
            await mockERC20.connect(user1).approve(dumpEx.getAddress(), sellAmount);
        
            // User1 sells tokens to the contract
            await dumpEx.connect(user1).sellToken(mockERC20.getAddress(), halfAmount);
            const balanceBefore = await ethers.provider.getBalance(dumpEx.getAddress());
        
            // Attempt to send the same amount of tokens directly to the contract without using sellToken function
            await mockERC20.connect(user1).transfer(dumpEx.getAddress(), halfAmount);
            const balanceAfter = await ethers.provider.getBalance(dumpEx.getAddress())
        
            // Attempt to extract value for the tokens sent directly
            expect(balanceAfter).to.equal(balanceBefore);
        });
        
        it("Token buy price >= token sell price", async function () {
            const sellAmount = ethers.parseUnits("100", 18);
            const sellAmountLarge = ethers.parseUnits("1000", 18);
            await mockERC20.mint(user1.address, sellAmount);
            await mockERC20.connect(user1).approve(dumpEx.getAddress(), sellAmount);
        
            // Get sell price
            const sellPrice = await dumpEx.getTokenSellPrice(mockERC20.getAddress(), sellAmountLarge);
            const buyPrice = await dumpEx.getTokenNetBuyPrice(mockERC20.getAddress(), sellAmount);
            expect(buyPrice).to.be.at.least(sellPrice);
        
            // User1 sells tokens
            await dumpEx.connect(user1).sellToken(mockERC20.getAddress(), sellAmount);
        
            // Get buy price for the same amount
            const newSellPrice = await dumpEx.getTokenSellPrice(mockERC20.getAddress(), sellAmountLarge);
            const newBuyPrice = await dumpEx.getTokenNetBuyPrice(mockERC20.getAddress(), sellAmount);
            expect(newBuyPrice).to.be.at.least(sellPrice);
            expect(newBuyPrice).to.be.at.least(newSellPrice);
        });

        it("It is not possible to buy x for a and then sell y>x for b>a", async function () {
            const buyAmount = ethers.parseUnits("50", 18);
            const sellAmount = ethers.parseUnits("100", 18);
            await mockERC20.mint(user1.address, sellAmount);
            await mockERC20.connect(user1).approve(dumpEx.getAddress(), sellAmount);

            // Buy tokens
            const buyPrice = await dumpEx.getTokenNetBuyPrice(mockERC20.getAddress(), sellAmount);
            const userOgEthBalance = await ethers.provider.getBalance(user1.address);
            const tx1 = await dumpEx.connect(user1).buyToken(mockERC20.getAddress(), buyAmount, { value: buyPrice });
            const receipt1 = await tx1.wait(); 
            const gasUsed1 = receipt1.gasUsed; // BigNumber of the gas used for the transaction
            const txDetails1 = await ethers.provider.getTransaction(tx1.hash);
            const gasPrice1 = txDetails1.gasPrice; // BigNumber of the gas price
            const gasCost1 = gasUsed1 * gasPrice1; // Total gas cost
        
            // Sell tokens
            const userOldEthBalance = await ethers.provider.getBalance(user1.address);
            const tx2 = await dumpEx.connect(user1).sellToken(mockERC20.getAddress(), sellAmount);
            const receipt2 = await tx2.wait(); 
            const gasUsed2 = receipt2.gasUsed; // BigNumber of the gas used for the transaction
            const txDetails2 = await ethers.provider.getTransaction(tx2.hash);
            const gasPrice2 = txDetails2.gasPrice; // BigNumber of the gas price
            const gasCost2 = gasUsed2 * gasPrice2; // Total gas cost
            const userNewEthBalance = await ethers.provider.getBalance(user1.address);

            // Calculate the net balance change, accounting for gas cost
            const pricePaid = userOgEthBalance + gasCost1 - userOldEthBalance; // The actual price paid for tokens
            const priceReceived = userNewEthBalance + gasCost2 - userOldEthBalance; // The actual price received for tokens
            expect(pricePaid).to.be.at.least(priceReceived); // User should have paid more than received
        });
        
        it("NFT buy price >= NFT sell price", async function () {
            // reset pricing
            await mockERC721.mint(user1.address, 514);
            await mockERC721.connect(user1).approve(dumpEx.getAddress(), 514);
            await dumpEx.connect(user1).sellNFT(mockERC721.getAddress(), 514);

            await mockERC721.mint(user1.address, 518);
            await mockERC721.connect(user1).approve(dumpEx.getAddress(), 518);
    
            const sellPrice = await dumpEx.getNftSellPrice(mockERC721.getAddress());
            await dumpEx.connect(user1).sellNFT(mockERC721.getAddress(), 518);
    
            const buyPrice = await dumpEx.getNftNetBuyPrice(mockERC721.getAddress());
    
            expect(buyPrice).to.be.at.least(sellPrice);
        });

        it("multibuyNFT does not allow extracting value", async function () {
            const tokenIdsToBuy = [902, 903, 904];
            const pricesBefore = await Promise.all(tokenIdsToBuy.map(async (id) => {
                mockERC721.mint(dumpEx.getAddress(), id);
                return dumpEx.getNftNetBuyPrice(mockERC721.getAddress());
            }));
        
            const totalCost = pricesBefore.reduce((acc, price) => acc + price, 0n);
            const ethBefore = await ethers.provider.getBalance(dumpEx.getAddress());
        
            // Assume multiBuyNFT is the function to buy multiple NFTs at once
            await dumpEx.connect(user1).multibuyNFT(mockERC721.getAddress(), tokenIdsToBuy, { value: totalCost });
        
            const ethAfter = await ethers.provider.getBalance(dumpEx.getAddress());
            expect(ethAfter - ethBefore).to.be.above(0n);        
        });
        
        it("multisellNFT does not allow extracting value", async function () {
            const tokenIdsToSell = [422, 423, 424];
            await Promise.all(tokenIdsToSell.map(async (id) => {
                await mockERC721.mint(user1.address, id);
                await mockERC721.connect(user1).approve(dumpEx.getAddress(), id);
            }));

            // Sell one to reset price
            await mockERC721.mint(user1.address, 421);
            await mockERC721.connect(user1).approve(dumpEx.getAddress(), 421)
            await dumpEx.connect(user1).sellNFT(mockERC721.getAddress(), 421)
        
            const ethBefore = await ethers.provider.getBalance(dumpEx.getAddress());
        
            // Assume multiSellNFT is the function to sell multiple NFTs at once
            await dumpEx.connect(user1).multisellNFT(mockERC721.getAddress(), tokenIdsToSell);
        
            const ethAfter = await ethers.provider.getBalance(dumpEx.getAddress());
            expect(ethAfter - ethBefore).to.equal(-1n); // Only one wei is paid
        });
        
    });

    describe("Admin Tests", function () {
        it("Only admin receives ether", async function () {
            // Put 1 ETH into the contract
            await owner.sendTransaction({
                to: owner.address,
                value: ethers.parseEther("10") // Send 10 ETH to owner
            });
            await owner.sendTransaction({
                to: dumpEx.getAddress(),
                value: ethers.parseEther("1")
            });

            const adminBalanceBefore = await ethers.provider.getBalance(owner.address);
            const userBalanceBefore = await ethers.provider.getBalance(user1.address);

            // Withdraw ether as non-admin
            const withdrawAmount = ethers.parseEther("0.5");
            await dumpEx.connect(user1).adminWithdrawEther(withdrawAmount);
            
            const adminBalanceAfter = await ethers.provider.getBalance(owner.address);
            const userBalanceAfter = await ethers.provider.getBalance(user1.address);

            expect(adminBalanceAfter).to.equal(adminBalanceBefore + withdrawAmount);
            expect(userBalanceAfter).to.be.below(userBalanceBefore);
        });
        it("All ether cannot be withdrawn", async function () {
            // Put 1 ETH into the contract
            await owner.sendTransaction({
                to: owner.address,
                value: ethers.parseEther("10") // Send 10 ETH to owner
            });
            await owner.sendTransaction({
                to: dumpEx.getAddress(),
                value: ethers.parseEther("1")
            });

            const contractBalance = await ethers.provider.getBalance(dumpEx.getAddress());
            await expect(dumpEx.connect(user1).adminWithdrawEther(contractBalance))
                .to.be.revertedWith("Withdrawing too much");
        });

        it("Only admin can set new admin", async function () {
            // Attempt to set new admin as non-admin
            await expect(
                dumpEx.connect(user1).setAdmin(user2.address)
            ).to.be.reverted;

            // Expect no pending admin changes
            expect(await dumpEx.pendingAdmin()).to.equal("0x0000000000000000000000000000000000000000");
        
            // Set new admin as admin
            await dumpEx.connect(owner).setAdmin(user2.address);
        
            // Verify new admin has not changed until acceptance
            expect(await dumpEx.admin()).to.equal(owner.address);
            expect(await dumpEx.pendingAdmin()).to.equal(user2.address);
        
            await dumpEx.connect(user2).acceptAdmin();
        
            // Verify new admin is set
            expect(await dumpEx.admin()).to.equal(user2.address);
        });    
        
        it("Admin fee is sent correctly", async function () {
            const buyAmount = ethers.parseUnits("1", 18);
            await mockERC20.mint(dumpEx.getAddress(), buyAmount);
    
            const adminAddress = await dumpEx.admin();
            const adminInitialBalance = await ethers.provider.getBalance(adminAddress);

            await mine(1000000);
    
            // User1 buys tokens from the contract
            const grossPrice = await dumpEx.connect(user1).getTokenBuyPrice(mockERC20.getAddress(), buyAmount);
            const protocolFee = await dumpEx.connect(user1).getProtocolFee(grossPrice);
            const netPrice = await dumpEx.connect(user1).getTokenNetBuyPrice(mockERC20.getAddress(), buyAmount);
            expect(netPrice).to.equal(grossPrice + protocolFee);
            await dumpEx.connect(user1).buyToken(mockERC20.getAddress(), buyAmount, { value: netPrice });
            const adminFinalBalance = await ethers.provider.getBalance(adminAddress);
            const protocolFeeActual = await dumpEx.connect(user1).getProtocolFee(grossPrice);
    
            // Admin balance should increase by the fee amount
            expect(adminFinalBalance - adminInitialBalance).to.equal(protocolFeeActual);
        });
    });

    describe("Additional Tests", function () {

        it("Ensures only approved NFTs can be sold", async function () {
            const tokenId = 331;
            await mockERC721.mint(user1.address, tokenId);
            // User1 tries to sell the NFT without approving it
            await expect(dumpEx.connect(user1).sellNFT(mockERC721.getAddress(), tokenId))
                .to.be.revertedWith("Not approved");
        });

        it("Ensures only approved tokens can be sold", async function () {
            const sellAmount = ethers.parseUnits("100", 18);
            await mockERC20.mint(user1.address, sellAmount);

            // Attempt to sell unapproved token
            await expect(dumpEx.connect(user1).sellToken(mockERC20.getAddress(), sellAmount))
                .to.be.revertedWith("Allowance is not sufficient");
        });

        it("Contract does not sell excess token inventory", async function () {
            await user1.sendTransaction({
                to: user1.address,
                value: ethers.parseEther("10") // Send ETH to user1
              });
              
            // Skip some blocks to come to a lower price
            await mine(15000000);

            const dumpExBalance = await mockERC20.balanceOf(dumpEx.getAddress());
            const buyAmount = dumpExBalance + ethers.parseUnits("1", 18);
            const totalCost = await dumpEx.connect(user1).getTokenNetBuyPrice(mockERC20.getAddress(), buyAmount);
        
            // User1 buys tokens from the contract
            await expect(
                dumpEx.connect(user1).buyToken(mockERC20.getAddress(), buyAmount, { value: totalCost })
            ).to.be.reverted;
        });

        it("Contract does not sell excess NFT inventory", async function () {
            await user1.sendTransaction({
                to: user1.address,
                value: ethers.parseEther("10") // Send ETH to user1
              });
              
            // Skip some blocks to come to a lower price
            await mine(15000000);

            const dummyNftId = 666;

            const totalCost = await dumpEx.connect(user1).getNftNetBuyPrice(mockERC721.getAddress());
        
            // User1 buys tokens from the contract
            await expect(
                dumpEx.connect(user1).buyNFT(mockERC721.getAddress(), dummyNftId, { value: totalCost })
            ).to.be.reverted;
        });
    });

    describe("Gas reporting", function () {
        it("Selling tokens", async function() {
            const amount = ethers.parseUnits("100", 18);
            await mockERC20.mint(user1.address, amount);
            await mockERC20.connect(user1).approve(dumpEx.getAddress(), amount);
            await mockERC20.connect(user1).transfer(user1.address, amount); // Ensure user1 has tokens to sell
            const tx = await dumpEx.connect(user1).sellToken(mockERC20.getAddress(), amount)
            const receipt = await tx.wait();
            console.log("     ", "Selling tokens:", receipt.gasUsed);
        })
        it("Buying tokens", async function() {
            const amount = ethers.parseUnits("100", 18);
            await mockERC20.mint(dumpEx.getAddress(), amount);
            const price = await dumpEx.connect(user1).getTokenNetBuyPrice(mockERC20.getAddress(), amount);
            const tx = await dumpEx.connect(user1).buyToken(mockERC20.getAddress(), amount, { value: price });
            const receipt = await tx.wait();
            console.log("     ", "Buying tokens:", receipt.gasUsed);
        })
        it("Selling NFTs", async function() {
            const amount = ethers.parseUnits("100", 18);
            await mockERC721.mint(user1.address, 734);
            await mockERC721.connect(user1).approve(dumpEx.getAddress(), 734);
            const tx = await dumpEx.connect(user1).sellNFT(mockERC721.getAddress(), 734)
            const receipt = await tx.wait();
            console.log("     ", "Selling NFTs:", receipt.gasUsed);
        })
        it("Buying NFTs", async function() {
            const price = await dumpEx.connect(user1).getNftNetBuyPrice(mockERC721.getAddress());
            const tx = await dumpEx.connect(user1).buyNFT(mockERC721.getAddress(), 734, { value: price });
            const receipt = await tx.wait();
            console.log("     ", "Buying NFTs:", receipt.gasUsed);
        })
    });
});