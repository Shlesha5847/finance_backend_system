# Finance Data Processing and Access Control API

Backend API built with Node.js, Express, MongoDB (Mongoose), JWT authentication, and role-based access control (RBAC).

## Overview

This project demonstrates a clean MVC-style backend architecture for managing finance records with:

- JWT-based authentication (`register`, `login`)
- RBAC with `viewer`, `analyst`, and `admin`
- Finance record CRUD APIs
- Summary API for analytics users
- Validation, centralized error handling, and standard response format
- Dynamic filtering, sorting, and pagination

## Tech Stack

- Node.js
- Express
- MongoDB (local instance)
- Mongoose ODM
- bcrypt
- jsonwebtoken

## Project Structure

```text
.
|-- server.js
|-- config/
|   `-- db.js
|-- models/
|   |-- User.js
|   `-- Finance.js
|-- routes/
|   |-- authRoutes.js
|   `-- financeRoutes.js
|-- controllers/
|   |-- authController.js
|   `-- financeController.js
|-- middleware/
|   |-- authMiddleware.js
|   |-- roleMiddleware.js
|   `-- errorMiddleware.js
|-- utils/
|   |-- validators.js
|   `-- response.js
|-- .env
|-- package.json
`-- README.md
```

## Setup Instructions

1. Ensure MongoDB is running locally.
2. Install dependencies:

```bash
npm install
```

3. Configure environment variables in `.env`:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/finance_api
JWT_SECRET=replace_with_secure_secret
JWT_EXPIRES_IN=1d
```

4. Run the project:

```bash
npm run dev
```

or

```bash
npm start
```

## Standard Response Format

All APIs use:

```json
{
  "success": true,
  "message": "string",
  "data": {}
}
```

`data` is omitted when not required.

## Authentication & JWT Usage

- Register and login with email/password.
- Password is hashed with bcrypt before storage.
- Login returns JWT token with `userId` and `role` payload.
- Send token in request headers:

```http
Authorization: Bearer <token>
```

## Roles and Permissions

- `viewer`
  - Can read finance records
- `analyst`
  - Can read finance records
  - Can access summary API
- `admin`
  - Full access (create, update, delete finance records)
  - Can read and access summary

## API Endpoints

Base URL: `http://localhost:5000`

### Auth APIs

#### POST `/api/auth/register`

Request:

```json
{
  "name": "Alice",
  "email": "alice@example.com",
  "password": "secret123",
  "role": "analyst"
}
```

Success Response (`201`):

```json
{
  "success": true,
  "message": "user registered successfully",
  "data": {
    "user": {
      "id": "user_id",
      "name": "Alice",
      "email": "alice@example.com",
      "role": "analyst"
    }
  }
}
```

#### POST `/api/auth/login`

Request:

```json
{
  "email": "alice@example.com",
  "password": "secret123"
}
```

Success Response (`200`):

```json
{
  "success": true,
  "message": "login successful",
  "data": {
    "token": "jwt_token",
    "user": {
      "id": "user_id",
      "name": "Alice",
      "email": "alice@example.com",
      "role": "analyst"
    }
  }
}
```

### Finance APIs

All finance routes require JWT in `Authorization` header.

#### POST `/api/finance` (admin only)

Request:

```json
{
  "title": "Salary",
  "amount": 5000,
  "type": "income",
  "category": "job",
  "date": "2024-01-10"
}
```

#### GET `/api/finance` (viewer, analyst, admin)

Supports filtering, sorting, pagination.

Filtering examples:

- `/api/finance?startDate=2024-01-01&endDate=2024-01-31`
- `/api/finance?category=food`
- `/api/finance?type=income`
- `/api/finance?category=food&type=expense&startDate=2024-01-01&endDate=2024-01-31`

Sorting examples:

- `/api/finance?sortBy=date&order=asc`
- `/api/finance?sortBy=amount&order=desc`

Pagination examples:

- `/api/finance?limit=10`
- `/api/finance?page=2`
- `/api/finance?limit=10&page=2`

Combined example:

- `/api/finance?type=expense&category=food&sortBy=amount&order=desc&limit=5&page=2`

Success Response (`200`):

```json
{
  "success": true,
  "message": "finance records fetched",
  "data": {
    "records": [],
    "pagination": {
      "totalRecords": 0,
      "totalPages": 0,
      "currentPage": 1,
      "limit": 10
    },
    "filters": {
      "startDate": null,
      "endDate": null,
      "category": null,
      "type": null
    },
    "sorting": {
      "sortBy": "date",
      "order": "desc"
    }
  }
}
```

#### PUT `/api/finance/:id` (admin only)

Request body can include any updatable fields:

```json
{
  "amount": 5200,
  "category": "primary-job"
}
```

#### DELETE `/api/finance/:id` (admin only)

Deletes finance record by id.

### Summary API

#### GET `/api/finance/summary` (analyst, admin)

Success Response (`200`):

```json
{
  "success": true,
  "message": "finance summary fetched",
  "data": {
    "totalIncome": 10000,
    "totalExpense": 4000,
    "groupedByCategory": [
      {
        "category": "food",
        "total": 1500
      },
      {
        "category": "rent",
        "total": 2500
      }
    ]
  }
}
```

## Validation and Error Handling

Implemented validation includes:

- Missing required fields
- Invalid email format
- Invalid role values
- Invalid finance type (`income`, `expense` only)
- Non-positive amount
- Invalid dates and IDs

Handled error conditions include:

- `400` Bad Request
- `401` Unauthorized (missing/invalid/expired token)
- `403` Forbidden (role not allowed)
- `404` Not Found (route/record not found)
- `500` Internal Server Error

## Assumptions

- Local MongoDB is available at the configured URI.
- Default role is `viewer` if role is omitted during registration.
- Finance summary is global across all finance records (not user-specific).
- Date filters use direct Date parsing from query values.
