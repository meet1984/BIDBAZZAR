# Backend tests

`bidding.service.test.ts` covers central server-side offer acceptance/rejection rules. `api.integration.test.ts` sends Express requests through routing and middleware to verify public validation and the error envelope. `setup.ts` provides isolated test configuration. Persistence and concurrency tests must use a dedicated disposable MySQL test database; the deployment workflow provisions one for CI validation.
