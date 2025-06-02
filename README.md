# Document Management API

A comprehensive NestJS backend application for user and document management with ingestion capabilities.

## Features

### 🔐 Authentication & Authorization
- JWT-based authentication
- Role-based access control (Admin, Editor, Viewer)
- User registration and login
- Password hashing with bcrypt

### 👥 User Management
- User CRUD operations
- Role management (Admin only)
- User profile management
- Account activation/deactivation

### 📄 Document Management
- File upload with validation
- Document metadata management
- File download functionality
- Role-based document access
- Document status tracking

### ⚙️ Ingestion Management
- Document processing job creation
- Job status tracking and management
- Webhook support for external services
- Microservices architecture ready

## Tech Stack

- **Framework**: NestJS with TypeScript
- **Database**: PostgreSQL with TypeORM
- **Authentication**: JWT with Passport
- **Validation**: class-validator
- **Documentation**: Swagger/OpenAPI
- **File Upload**: Multer

## Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd doc-manger
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit the `.env` file with your configuration:
   ```env
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_USERNAME=main
   DB_PASSWORD=main
   DB_NAME=doc_management
   
   # JWT Configuration
   JWT_SECRET=secret-key
   JWT_EXPIRES_IN=24h
   ```

4. **Set up PostgreSQL database**
   ```sql
   CREATE DATABASE doc_management;
   ```

## Running the Application

### Development
```bash
npm run start:dev
```

### Production
```bash
npm run build
npm run start:prod
```

The application will be available at:
- **API**: http://localhost:3000/api
- **Swagger Documentation**: http://localhost:3000/api/docs

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user

### User Management
- `GET /api/users` - Get all users (Admin only)
- `GET /api/users/profile` - Get current user profile
- `GET /api/users/:id` - Get user by ID (Admin only)
- `PATCH /api/users/profile` - Update current user profile
- `PATCH /api/users/:id` - Update user by ID (Admin only)
- `PATCH /api/users/:id/update-status` - Update user status (Admin only)
- `DELETE /api/users/:id` - Delete user (Admin only)

### Document Management
- `POST /api/documents/upload` - Upload a document
- `GET /api/documents` - Get all documents (filtered by role)
- `GET /api/documents/:id` - Get document by ID
- `GET /api/documents/:id/download` - Download document file
- `PATCH /api/documents/:id` - Update document metadata
- `PATCH /api/documents/:id/status` - Update document status (Admin only)
- `DELETE /api/documents/:id` - Delete document

### Ingestion Management
- `POST /api/ingestion/jobs` - Create ingestion job
- `GET /api/ingestion/jobs` - Get all ingestion jobs (filtered by role)
- `GET /api/ingestion/jobs/:id` - Get ingestion job by ID
- `PATCH /api/ingestion/jobs/:id` - Update ingestion job (Admin only)
- `POST /api/ingestion/jobs/:id/cancel` - Cancel ingestion job
- `DELETE /api/ingestion/jobs/:id` - Delete ingestion job (Admin only)
- `POST /api/ingestion/webhook/:jobId` - Webhook for external services

## User Roles

### Admin
- Full access to all endpoints
- Can manage users and their roles
- Can view and manage all documents and jobs
- Can update document and job statuses

### Editor
- Can upload and manage their own documents
- Can create and manage ingestion jobs for their documents
- Cannot access admin-only endpoints

### Viewer
- Can view their own documents
- Can download their own documents
- Cannot upload or modify documents
- Cannot create ingestion jobs

## File Upload

The API supports file uploads with the following constraints:
- **Maximum file size**: 50MB
- **Supported formats**: All file types
- **Storage**: Local filesystem

### Upload Example
```bash
curl -X POST \
  http://localhost:3000/api/documents/upload \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: multipart/form-data' \
  -F 'file=@/path/to/your/document.pdf' \
  -F 'description=Important document' \
  -F 'metadata={"category":"legal","tags":["contract"]}'
```

## Database Schema

### Users Table
- `id` (UUID, Primary Key)
- `email` (String, Unique)
- `firstName` (String)
- `lastName` (String)
- `password` (String, Hashed)
- `role` (Enum: admin, editor, viewer)
- `isActive` (Boolean)
- `createdAt` (Timestamp)
- `updatedAt` (Timestamp)

### Documents Table
- `id` (UUID, Primary Key)
- `filename` (String)
- `originalName` (String)
- `mimeType` (String)
- `size` (BigInt)
- `filePath` (String)
- `status` (Enum: uploaded, processing, processed, failed)
- `description` (Text, Optional)
- `metadata` (JSON, Optional)
- `uploadedById` (UUID, Foreign Key)
- `createdAt` (Timestamp)
- `updatedAt` (Timestamp)

### Ingestion Jobs Table
- `id` (UUID, Primary Key)
- `status` (Enum: pending, running, completed, failed, cancelled)
- `errorMessage` (Text, Optional)
- `result` (JSON, Optional)
- `config` (JSON, Optional)
- `documentId` (UUID, Foreign Key)
- `createdAt` (Timestamp)
- `updatedAt` (Timestamp)
- `startedAt` (Timestamp, Optional)
- `completedAt` (Timestamp, Optional)

## Development

### Running Tests
```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Performance tests
npm run test:e2e -- --testPathPattern=performance

# Test coverage
npm run test:cov
```

### Code Quality
```bash
# Linting
npm run lint

# Formatting
npm run format
```

## Security Considerations

1. **Environment Variables**: Never commit `.env` files to version control
2. **JWT Secret**: Use a strong, unique secret in production
3. **Database**: Use strong passwords and restrict access
4. **File Upload**: Implement file type validation and virus scanning
5. **Rate Limiting**: Consider implementing rate limiting for API endpoints
6. **HTTPS**: Always use HTTPS in production

## Deployment

### Docker (Recommended)
```dockerfile
# Example Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
```

## License

This project is licensed under the MIT License.