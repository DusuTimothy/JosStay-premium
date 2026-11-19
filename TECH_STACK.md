# Tech Stack

Technology stack for building **JosStay Premium**.

## Languages & Markup
- **HTML** – Structure and semantic markup for web pages
- **JavaScript** – Primary programming language for frontend and backend logic

## Frontend
- **React.js** – Component-based UI library
- **Next.js** – React framework for routing, rendering, and application structure
- **Tailwind CSS** – Utility-first CSS framework for styling

## Backend
- **Node.js** – JavaScript runtime for server-side development
- **Express.js** – Web framework for building APIs and server logic

## HTTP & Data Fetching
- **Axios** – HTTP client for API requests

## Database, ORM & Storage
- **PostgreSQL** – Primary relational database
- **Aiven for PostgreSQL** – Managed Postgres hosting with TLS/CA certificate support
- **pg** – Node.js PostgreSQL client for parameterized queries and pooling
- **SQL migrations** – Schema and constraint management in `db/migrations/`
- **Row Level Security (RLS)** – Enabled as defense-in-depth alongside API authorization

## Caching
- **Redis / Valkey** – In-memory data store for caching and performance optimization
- **Aiven for Redis/Valkey** – Managed Redis-compatible hosting with TLS/CA certificate support
- **redis (node-redis)** – Node.js Redis client

## Validation, Uploads & Configuration
- **Zod** – Schema validation for request/data validation
- **Multer** – Middleware for handling file uploads
- **dotenv** – Environment variable management

## Security & Access Control
- **Helmet** – HTTP security headers middleware
- **CORS** – Cross-origin resource sharing configuration
- **bcrypt** – Password hashing
- **JWT** – Signed HS256 access tokens
- **express-rate-limit** – API and authentication throttling
- **TLS CA certificates** – Verified connections to Aiven PostgreSQL/Redis
- **Google Sign-Up** – OAuth-based authentication with Google
- **RBAC (Role-Based Access Control)** – Authorization based on user roles and permissions

## Integrations & Services
- **Brevo** – Email/communication service integration
- **Paystack** – Payment processing integration
- **WhatsApp Integration** – Messaging/communication via WhatsApp
- **AI/LLM Integration** – AI-powered features using large language models

## Analytics
- **Data Analysis** – Data insights and reporting capabilities

## Deployment & Hosting
- **Render** – Backend/application hosting
- **Vercel** – Frontend/Next.js hosting and deployment
