# DocAppoint - Full-Stack Doctor Appointment System

DocAppoint is a modern, full-stack healthcare and doctor appointment scheduling application. This ecosystem is built using a decoupled Client-Server architecture, featuring a secure JWT-based authentication layer, Google OAuth integration, dynamic physician directories, and a robust appointment booking workflow.

---

## 🏗️ System Architecture & Data Flow

The application isolates the user interface from the data persistence layer. Secure data transmission relies on JSON Web Tokens (JWT) passed via the `Authorization` header using the `Bearer` scheme.

```text
+------------------------------------------------------------------------+
|                                                                        |
|   [ Browser / React Client ]                                           |
|          |                                                             |
|          |-- (POST /api/auth/login) ----> [ Express Server Engine ]    |
|          |<-- (Returns Signed JWT + User) ---------|                   |
|          |                                         |                   |
|   [ LocalStorage ]                                 v                   |
|   Stores: token, user                      [ verifyToken Middleware ]  |
|          |                                         |                   |
|          |-- (Header: Bearer <token>) ------------>|                   |
|                                                    |-- (Valid?) ----> [ MongoDB Atlas ]
+------------------------------------------------------------------------+