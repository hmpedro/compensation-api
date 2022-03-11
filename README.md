# Compensation API

An API that abstracts the situation of contractors doing jobs for clients under a contract.

## Data Models

### Profile
A profile can be either a `client` or a `contractor`. 
Clients create contracts with contractors. 
Contractor executes jobs for clients and get paid.
Each profile has a balance property.

### Contract
A contract exists between a client and a contractor.
Contracts have 3 statuses, `new`, `in_progress`, `terminated`. 
Contracts are considered active only when in status `in_progress`
Contracts group jobs within them.

### Job
Contractors get paid for jobs by clients under a certain contract.

## Running the project
  
Install Node or you can use `nvm use` on root folder.

1. Run `npm install` to gather all dependencies.
2. Next, `npm run seed` will seed the local SQLite database. **Warning: This will drop the database if it exists**. The database lives in a local file `database.sqlite3`.
3. Then run `npm start` which should start both the server.

## Technical Notes

- The server is running with [nodemon](https://nodemon.io/) which will automatically restart for you when you modify and save a file.
- The database provider is SQLite, which will store data in a file local to your repository called `database.sqlite3`. The ORM [Sequelize](http://docs.sequelizejs.com/) is on top of it. You should only have to interact with Sequelize.
- To authenticate users use the `getProfile` middleware that is located under src/middleware/getProfile.js. users are authenticated by passing `profile_id` in the request header. after a user is authenticated his profile will be available under `req.profile`. make sure only users that are on the contract can access their contracts.
- The server is running on port 3001.

## API  

- ***GET*** `/contracts/:id` - Returns the contract only if it belongs to the profile calling.
```
curl --request GET 'localhost:3001/contracts/1' \
--header 'profile_id: 1'
```
  
- ***GET*** `/contracts` - Returns a list of contracts belonging to a user (client or contractor), the list should only contain non terminated contracts.
```
curl --request GET 'localhost:3001/contracts' \
--header 'profile_id: 1'
```
  
- ***GET*** `/jobs/unpaid` -  Get all unpaid jobs for a user (***either*** a client or contractor), for ***active contracts only***.
```
curl --request GET 'localhost:3001/jobs/unpaid' \
--header 'profile_id: 2'
```
  
- ***POST*** `/jobs/:job_id/pay` - Pay for a job, a client can only pay if his balance >= the amount to pay. The amount should be moved from the client's balance to the contractor balance.
```
curl --request POST 'localhost:3001/jobs/2/pay' \
--header 'profile_id: 1'
```
  
- ***POST*** `/balances/deposit/:userId` - Deposits money into the the the balance of a client, a client can't deposit more than 25% his total of jobs to pay. (at the deposit moment)
```
curl --request POST 'localhost:3001/balances/deposit/2' \
--header 'profile_id: 1' \
--header 'Content-Type: application/json' \
--data-raw '{
    "deposit": 20
}'
```
  
- ***GET*** `/admin/best-profession?start=<date>&end=<date>` - Returns the profession that earned the most money (sum of jobs paid) for any contactor that worked in the query time range.
```
curl --request GET 'localhost:3001/admin/best-profession?start=2020-08-17&end=2020-08-20' \
--header 'profile_id: 1'
```
  
- ***GET*** `/admin/best-clients?start=<date>&end=<date>&limit=<integer>` - returns the clients the paid the most for jobs in the query time period. limit query parameter should be applied, default limit is 2.
```
curl --request GET 'localhost:3001/admin/best-clients?start=2020-08-12&end=2020-08-20&limit=4' \
--header 'profile_id: 1'
```
  
## Going Above and Beyond
The code is functional right now, I would spend some time in the following points:

- [ ] Refactor the code, splitting it into modules and splitting each module on layers.
- [ ] Create unit tests
- [ ] Create integration tests  

PS: I would use `jest` for tests. After the refactoring the code should be decoupled and easier to create the tests.

My way of thinking is: First make it work, then you can improve it. I think tests are a real need on this situation because we have lots of business rules.
