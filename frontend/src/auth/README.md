# Authentication

`AuthPage.jsx` handles buyer/seller login, registration and OTP verification; `ForgotPasswordPage.jsx` handles single-use password-reset links; `AuthContext.jsx` owns the in-memory access token/current user; and `ProtectedRoute.jsx` enforces dashboard roles in the UI. The backend remains the security boundary.
