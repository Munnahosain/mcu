# Environment Setup Guide

This project requires several environment variables to be configured. Follow these steps to set up your local development environment.

## Quick Setup

1. **Copy the example file:**
   ```bash
   cp .env.example .env.local
   ```

2. **Fill in the required values** in `.env.local`:

### Required Environment Variables

#### API Keys

- **POOF_API_KEY** or **REMOVE_BG_API_KEY**
  - Used for background removal feature
  - Get your API key from: https://www.remove.bg/api
  - You only need ONE of these configured
  - Example: `POOF_API_KEY=sk_test_xxxxxxxxxxxxx`

- **GROQ_API_KEY**
  - Used for AI features
  - Get your API key from: https://console.groq.com
  - Example: `GROQ_API_KEY=gsk_xxxxxxxxxxxxx`

#### Database

- **MONGODB_URI**
  - MongoDB connection string for data persistence
  - Format: `mongodb+srv://username:password@cluster.mongodb.net/dbname`
  - Get MongoDB Atlas cluster from: https://www.mongodb.com/cloud/atlas

#### Authentication

- **JWT_SECRET**
  - Secret key for JWT token signing
  - Should be a random, secure string (minimum 32 characters recommended)
  - Example: `JWT_SECRET=$(openssl rand -hex 32)`

## Building the Project

The build process will **not fail** if API keys are missing. Instead:
- Missing API keys will result in a 503 Service Unavailable response when that feature is accessed
- This allows you to build and deploy the project without all keys configured

To build:
```bash
npm run build
```

## Development

To run the development server:
```bash
npm run dev
```

The dev server will start on http://localhost:3000

## Production Deployment

Make sure all required environment variables are set in your production environment:
- Set these via your deployment platform's environment variables settings
- Do NOT commit `.env.local` or any `.env` files to version control
- `.env*` files are already gitignored in this project

## Troubleshooting

### Build Fails with "API key is required"
- This should no longer happen after the recent fixes
- If it does, check that you're running the latest code
- Verify Node.js version matches (16.x or higher recommended)

### Background Removal Returns 503 Error
- You need to configure `POOF_API_KEY` or `REMOVE_BG_API_KEY`
- Verify the API key is valid
- Check that the API key has available credits

### MongoDB Connection Fails
- Verify `MONGODB_URI` is correct
- Check database credentials
- Ensure your IP is whitelisted in MongoDB Atlas
- Check network connectivity

## More Information

- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [remove.bg API Documentation](https://www.remove.bg/api)
- [Groq API Documentation](https://console.groq.com/docs)
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
