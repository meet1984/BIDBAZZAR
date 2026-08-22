# HTTP middleware

This folder contains bearer-token/role enforcement, Zod validation, standardized errors/404s, public/auth/offer rate limits, and upload validation. Routes compose these before controllers. Security and transport-wide behavior belongs here; domain rules belong in services. Production should supplement the in-process limiter with an edge/WAF policy when multiple application processes are used.
