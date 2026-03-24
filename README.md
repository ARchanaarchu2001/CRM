# MERN Role-Based Authentication System

A comprehensive, production-ready MERN stack authentication system featuring secure JWT handling, HttpOnly refresh cookies, Redux Toolkit state management, and hierarchical Role-Based Access Control (RBAC).

## Features
- **JWT Authentication**: Short-lived Access Tokens for speed, long-lived Refresh Tokens for UX.
- **Secure Storage**: Refresh tokens are stored strictly in `HttpOnly`, `SameSite` cookies to prevent XSS and CSRF.
- **Role-Based Access Control (RBAC)**: Hierarchical routing (`SUPER_ADMIN`, `DATA_ANALYST`, `TEAM_LEAD`, `MANAGER`, `AGENT`).
- **Axios Interceptors**: Completely automated background token refreshing using silent interceptors.
- **State Management**: Redux Toolkit slices and async thunks powering React UI hooks.
- **Tailwind UI**: Modern, responsive login and protected dashboard scaffolding.

## 1. Installation

### Backend Setup
Navigate to the backend directory and install the packages.
```bash
cd backend
npm install
```

### Frontend Setup
Navigate to the frontend directory and install the packages.
```bash
cd frontend
npm install
```

## 2. Environment Variables (.env)

**Create `backend/.env`:**
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/mern_auth_db
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=your_super_secret_refresh_key
REFRESH_TOKEN_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:5173
```

**Create `frontend/.env`:**
```env
VITE_API_URL=http://localhost:5000/api
```

## 3. Database Seeding
To initialize the database with the core testing roles, ensure MongoDB is running locally and execute:
```bash
cd backend
node seeders/seedUsers.js
```
*(This will safely generate 5 hierarchical accounts like `superadmin@example.com`, `manager@example.com`, etc. with the default password `password123`)*

## 4. Running the Project

**Start the Backend Server:**
```bash
cd backend
npm run dev
```

**Start the Vite Frontend:**
```bash
cd frontend
npm run dev
```

## 5. Architecture & Authentication Flow
1. **Initial Login**: The React UI dispatches the `loginUser` slice. Express validates the credentials against `bcrypt` databases. If successful, it generates two tokens:
   - `accessToken`: Sent in the JSON payload and saved to Redux `auth.accessToken`.
   - `refreshToken`: Locked inside an `HttpOnly` cookie safely attached to the client browser.
2. **Accessing Routes**: Frontend components automatically retrieve the Redux `accessToken` when executing fetches, and Axios securely injects it into every outbound API header (`Authorization: Bearer <token>`).
3. **Silent Automated Refresh**: When the 15-minute `accessToken` ultimately expires, Express throws a `401 Unauthorized` block. The Axios Response Interceptor catches this, freezes the failed request, and quietly pings `/api/auth/refresh-token`. Express reads the secure `HttpOnly` cookie, rotates it in the database safely, and issues a fresh `accessToken`. Axios automatically maps this to Redux and seamlessly retries the original request without disrupting the UI UX!
4. **Session Persistence**: On hard page reloads where Redux wipes, React's `<PersistLogin />` component natively queries the refresh endpoint in the background before rendering the DOM layout, pulling the active session securely back to life.
5. **Logout Integration**: Pressing logout commands the Express server to nullify the refresh token strictly inside the database and wipe the cookie from the browser, gracefully kicking the user back to the login screen.
