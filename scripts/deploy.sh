#!/bin/bash

# Quick deployment script for Mee
# Usage: ./scripts/deploy.sh [docker|manual]

set -e

DEPLOY_METHOD=${1:-docker}
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "🚀 Mee Deployment Script"
echo "=================================="
echo ""

if [ "$DEPLOY_METHOD" = "docker" ]; then
    echo "📦 Deploying with Docker..."
    echo ""
    
    # Check if .env exists
    if [ ! -f "$PROJECT_ROOT/.env" ]; then
        echo "⚠️  .env file not found. Creating from example..."
        if [ -f "$PROJECT_ROOT/.env.example" ]; then
            cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
            echo "✅ Created .env file. Please edit it and set JWT_SECRET!"
            echo "   Generate a secret: openssl rand -base64 32"
            exit 1
        else
            echo "❌ .env.example not found. Please create .env manually."
            exit 1
        fi
    fi
    
    # Check if JWT_SECRET is set
    if ! grep -q "JWT_SECRET=" "$PROJECT_ROOT/.env" || grep -q "JWT_SECRET=your-super-secret" "$PROJECT_ROOT/.env"; then
        echo "⚠️  JWT_SECRET not set or using default value!"
        echo "   Please edit .env and set a secure JWT_SECRET"
        echo "   Generate one: openssl rand -base64 32"
        exit 1
    fi
    
    cd "$PROJECT_ROOT"
    
    echo "🐳 Starting Docker containers..."
    docker-compose up -d
    
    echo ""
    echo "✅ Deployment complete!"
    echo ""
    echo "Services:"
    echo "  - Backend API: http://localhost:4000"
    echo "  - Web Dashboard: http://localhost"
    echo "  - MongoDB: localhost:27017"
    echo ""
    echo "Check logs: docker-compose logs -f"
    echo "Stop services: docker-compose down"
    
elif [ "$DEPLOY_METHOD" = "manual" ]; then
    echo "📝 Manual deployment steps:"
    echo ""
    echo "1. Install dependencies:"
    echo "   npm install --production"
    echo ""
    echo "2. Set environment variables:"
    echo "   export PORT=4000"
    echo "   export MONGO_URI=mongodb://localhost:27017/mee"
    echo "   export JWT_SECRET=\$(openssl rand -base64 32)"
    echo "   export NODE_ENV=production"
    echo ""
    echo "3. Start MongoDB (if not running)"
    echo ""
    echo "4. Start the server:"
    echo "   npm run server"
    echo "   # Or with PM2:"
    echo "   pm2 start server.js --name mee-backend"
    echo ""
    echo "5. Deploy web dashboard to your static host"
    echo ""
    echo "See DEPLOYMENT.md for detailed instructions."
    
else
    echo "❌ Unknown deployment method: $DEPLOY_METHOD"
    echo "Usage: ./scripts/deploy.sh [docker|manual]"
    exit 1
fi


