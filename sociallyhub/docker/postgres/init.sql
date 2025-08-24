-- Initialize the database
-- This file runs when the PostgreSQL container starts for the first time

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Database is already created by POSTGRES_DB environment variable
-- User is already created by POSTGRES_USER environment variable

-- Set timezone
ALTER DATABASE sociallyhub SET timezone TO 'UTC';