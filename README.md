
## Digital Safe for ERC-20 tokens and ETH

## Description
A safe, which holds any ERC-20 token or ETH for a fee of 0.005% per day.  
Users may deposit and withdraw with no time period locks.  
Users start accumulating fees from the time of their deposit.  
Owner of the contract may withdraw the fees at their discretion to any address.  

## Instructions for project  

All commands are in package.json.  
Make sure to run `npm i` first.  
`cp .env.example .env` and setup config.   

To run tests:  
`npm run test`  
To get code coverage:  
`npm run coverage`  
To get slither static analysis report:  
`npm run slither`  
To deploy on mainnet:  
`npm run deploy`  
To deploy on tenderly fork:  
`npm run deploy:tenderly`  
To interact with tenderly fork:  
`npm run interact`  

## Gas costs of Safe functions  
`deposit` - avg. 80208, max 112k (on first deposit for token)  
`withdraw` - max 56843  
`collectFees` - max 51470  
