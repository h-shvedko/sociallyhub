# SociallyHub - Social Media Command Center

A comprehensive social media management platform built with Next.js 14, TypeScript, and modern technologies.

## 🚀 Features

- **Multi-Platform Publishing**: Post to X (Twitter), Facebook, Instagram, LinkedIn, YouTube, and TikTok from one interface
- **Unified Inbox**: Manage all comments, mentions, and messages in one place
- **Smart Scheduling**: Schedule posts with optimal timing recommendations
- **Team Collaboration**: Role-based permissions and approval workflows
- **Analytics Dashboard**: Track performance across all platforms
- **Multi-Client Support**: Perfect for agencies managing multiple clients
- **Asset Management**: Centralized media library with processing capabilities

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety throughout the application
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - High-quality React components
- **React Hook Form** - Performant forms with validation
- **Zustand** - Lightweight state management
- **TanStack Query** - Server state management

### Backend
- **Prisma ORM** - Type-safe database access
- **PostgreSQL** - Primary database
- **NextAuth.js** - Authentication system
- **BullMQ** - Background job processing
- **Redis** - Caching and job queue

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone [repository-url]
   cd sociallyhub
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Fill in your environment variables in `.env`:
   - Database URL
   - NextAuth secret
   - Social media API credentials
   - Redis URL
   - Storage credentials

4. **Set up the database**
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to `http://localhost:3000`

## 🔧 Configuration

### Social Media API Setup

You'll need to create developer accounts and apps for each platform:

1. **Twitter/X API** - Get API keys from Twitter Developer Portal
2. **Facebook/Instagram API** - Create Facebook app with Instagram permissions
3. **LinkedIn API** - Create LinkedIn Developer app
4. **YouTube API** - Enable YouTube Data API in Google Cloud Console
5. **TikTok API** - Apply for TikTok for Business API access

Add all credentials to your `.env` file.

## 📝 Usage

### Getting Started

1. **Create an Account**: Sign up or sign in to your SociallyHub account
2. **Connect Social Accounts**: Link your social media accounts
3. **Create Your First Post**: Use the Compose feature to create and schedule posts
4. **Manage Your Inbox**: Respond to comments and messages
5. **Analyze Performance**: View insights in the Analytics dashboard

## 🏗️ Architecture

### Database Schema

Multi-tenant architecture with:
- **Users & Workspaces**: Role-based permissions
- **Social Accounts**: Token management and OAuth
- **Posts & Variants**: Platform-specific content
- **Inbox & Conversations**: Unified messaging
- **Analytics**: Performance tracking
- **Assets**: Media library

## 🧪 Development

```bash
# Start development server
npm run dev

# Run database migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# View database in Prisma Studio
npx prisma studio
```

## 📄 License

MIT License - see the [LICENSE](LICENSE) file for details.

---

Built with ❤️ for social media managers and digital agencies worldwide.
