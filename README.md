# Karay Suchi — Backend API

This repository contains the REST API for Karay Suchi, a workspace-based productivity application for managing tasks, notes, and team access. It demonstrates secure authentication, role-based authorization, structured API design, and MongoDB data modeling in a production-oriented Express application.

## Live demo

Explore the complete application at [karaysuchi.razsoft.in](https://karaysuchi.razsoft.in/).

A shared account is available for recruiters, evaluators, and anyone who would like to review the application's UI and functionality:

- **User ID:** `test@example.com`
- **Password:** `Test@1234`

The account is intended for public project evaluation, so its data may be changed by other visitors.

## API capabilities

- Registration with automatic creation of a personal default workspace
- JWT access and refresh tokens delivered through secure HTTP-only cookies
- Session renewal, logout, and protected-route middleware
- Workspace create, read, update, and delete operations
- Workspace membership managed by email with Owner, Editor, and Viewer roles
- Role-aware access to workspace tasks and notes
- Task CRUD, priorities, due dates, and To Do, In Progress, and Completed states
- Note CRUD with workspace ownership and access validation
- Request validation, centralized error handling, logging, and CORS configuration

## Workspace permissions

| Role | Access |
| --- | --- |
| Owner | Manage the workspace, members, tasks, and notes |
| Editor | View and modify tasks and notes in the workspace |
| Viewer | View workspace tasks and notes without changing them |

## Backend stack

- Node.js and Express 5
- MongoDB and Mongoose
- JSON Web Tokens and HTTP-only cookies
- bcrypt for password hashing
- Zod for request validation
- Morgan, CORS, and dotenv

## Getting started

### Prerequisites

- Node.js 20 or later
- npm
- A local or hosted MongoDB instance

### Installation

1. Install the dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env`, then replace the example secrets and update any values required for your environment.

3. Ensure MongoDB is running, then start the API:

   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:8000/api/v1`. Start the frontend separately at `http://localhost:5173`.

### Available commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the API with Node.js watch mode |
| `npm run prod` | Start the API without watch mode |

## Main API areas

| Area | Responsibility |
| --- | --- |
| Authentication | Register, log in, refresh sessions, and log out |
| Workspaces | Manage owned workspaces and retrieve accessible workspaces |
| Members | Add users, change roles, and remove workspace members |
| Tasks | Manage workspace tasks and workflow status |
| Notes | Manage workspace notes |

## Project structure

```text
src/
├── config/        Database and application configuration
├── controllers/   Request handling and application logic
├── middleware/    Authentication, authorization, and errors
├── models/        Mongoose schemas and relationships
├── routes/        Versioned API endpoints
└── utils/         Shared helpers and token utilities
```

## Author

Built by **Rohit Kumar** as a full-stack portfolio project.

- [GitHub](https://github.com/RazSoft123)
- [LinkedIn](https://www.linkedin.com/in/rohit-raz-webdev)
