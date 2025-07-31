#!/bin/bash

# AI Chatbot Template - Vercel Deployment Script
# This script automates the deployment process to Vercel

set -e

echo "🚀 Starting AI Chatbot deployment to Vercel..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Vercel CLI is installed
check_vercel_cli() {
    if ! command -v vercel &> /dev/null; then
        print_error "Vercel CLI is not installed. Please install it first:"
        echo "npm install -g vercel"
        exit 1
    fi
    print_success "Vercel CLI is installed"
}

# Check if user is logged in to Vercel
check_vercel_login() {
    if ! vercel whoami &> /dev/null; then
        print_warning "You are not logged in to Vercel. Please login first:"
        echo "vercel login"
        exit 1
    fi
    print_success "Logged in to Vercel as $(vercel whoami)"
}

# Check if .env file exists
check_env_file() {
    if [ ! -f ".env.local" ]; then
        print_warning ".env.local file not found. Creating template..."
        cat > .env.local << EOF
# Backend Environment Variables
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ai-chatbot
REDIS_URL=redis://username:password@host:port
OPENROUTER_API_KEY=your-openrouter-api-key
JWT_SECRET=your-super-secret-jwt-key
NODE_ENV=production
FRONTEND_URL=https://your-app.vercel.app

# Frontend Environment Variables
VITE_API_URL=https://your-app.vercel.app/api
VITE_APP_NAME=AI Chatbot
EOF
        print_error "Please update .env.local with your actual values before deploying"
        exit 1
    fi
    print_success ".env.local file found"
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    # Install root dependencies
    npm install
    
    # Install backend dependencies
    cd apps/backend
    npm install
    cd ../..
    
    # Install frontend dependencies
    cd apps/frontend
    npm install
    cd ../..
    
    print_success "Dependencies installed"
}

# Build the project
build_project() {
    print_status "Building the project..."
    
    # Build backend
    cd apps/backend
    npm run build
    cd ../..
    
    # Build frontend
    cd apps/frontend
    npm run build
    cd ../..
    
    print_success "Project built successfully"
}

# Deploy to Vercel
deploy_to_vercel() {
    print_status "Deploying to Vercel..."
    
    # Check if this is a production deployment
    if [ "$1" = "--prod" ]; then
        print_status "Deploying to production..."
        vercel --prod
    else
        print_status "Deploying to preview..."
        vercel
    fi
    
    print_success "Deployment completed!"
}

# Main deployment function
main() {
    print_status "Starting deployment process..."
    
    # Run checks
    check_vercel_cli
    check_vercel_login
    check_env_file
    
    # Install dependencies
    install_dependencies
    
    # Build project
    build_project
    
    # Deploy
    deploy_to_vercel "$1"
    
    print_success "🎉 Deployment completed successfully!"
    print_status "Your app should be available at the URL provided by Vercel"
}

# Handle command line arguments
case "$1" in
    --prod)
        main --prod
        ;;
    --help|-h)
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --prod    Deploy to production"
        echo "  --help    Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0          # Deploy to preview"
        echo "  $0 --prod   # Deploy to production"
        ;;
    *)
        main
        ;;
esac 