# Newsletter module

This public module validates an email, rate-limits requests, and upserts a persisted subscription. Controller, service and repository remain separate so consent and delivery-provider integrations can be added without changing the public form contract.
