# Authentication module

Routes expose registration, OTP login verification, refresh rotation, logout, current-user lookup and password recovery. Public registration is limited to buyers and sellers; the controller owns secure refresh cookies; repositories persist accounts, profiles, hashed refresh tokens, OTP challenges and single-use password-reset tokens. Token primitives live in `shared/tokens.ts`, and role checks live in middleware.
