#!/bin/bash
# ParaWave PTT iOS Development Setup Script
# This script sets up the development environment for iOS development

set -e

echo "🚀 ParaWave PTT iOS Development Setup"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IOS_DIR="$PROJECT_ROOT/ios"

echo -e "${BLUE}📍 Project root: $PROJECT_ROOT${NC}"
echo -e "${BLUE}📱 iOS directory: $IOS_DIR${NC}"

# Check if .env file exists at project root
if [ ! -f "$PROJECT_ROOT/.env" ]; then
    echo -e "${YELLOW}⚠️  .env file not found at project root${NC}"
    echo "Creating .env file from template..."
    
    if [ -f "$IOS_DIR/.env.example" ]; then
        cp "$IOS_DIR/.env.example" "$PROJECT_ROOT/.env"
        echo -e "${GREEN}✅ Created .env file from iOS template${NC}"
        echo -e "${YELLOW}📝 Please edit $PROJECT_ROOT/.env with your configuration${NC}"
    else
        echo -e "${RED}❌ .env.example template not found${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ .env file found at project root${NC}"
fi

# Validate essential environment variables
echo ""
echo "🔍 Validating environment configuration..."

required_vars=(
    "AUTH0_DOMAIN"
    "AUTH0_CLIENT_ID"
    "API_BASE_URL"
    "APPLE_APP_BUNDLE_ID"
)

missing_vars=()

# Source the .env file
if [ -f "$PROJECT_ROOT/.env" ]; then
    set -o allexport
    source "$PROJECT_ROOT/.env"
    set +o allexport
fi

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    else
        echo -e "${GREEN}✅ $var is set${NC}"
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo -e "${RED}❌ Missing required environment variables:${NC}"
    for var in "${missing_vars[@]}"; do
        echo -e "${RED}   - $var${NC}"
    done
    echo -e "${YELLOW}📝 Please update $PROJECT_ROOT/.env with the missing variables${NC}"
    exit 1
fi

# Check Xcode installation
echo ""
echo "🔨 Checking development tools..."

if ! command -v xcodebuild &> /dev/null; then
    echo -e "${RED}❌ Xcode not found. Please install Xcode from the App Store.${NC}"
    exit 1
else
    echo -e "${GREEN}✅ Xcode is installed${NC}"
    xcode_version=$(xcodebuild -version | head -n 1)
    echo -e "${BLUE}   Version: $xcode_version${NC}"
fi

# Check if iOS project exists
if [ ! -f "$IOS_DIR/ParaWavePTT/ParaWavePTT.xcodeproj/project.pbxproj" ]; then
    echo -e "${RED}❌ iOS project not found at expected location${NC}"
    exit 1
else
    echo -e "${GREEN}✅ iOS project found${NC}"
fi

# Display configuration summary
echo ""
echo "📋 Configuration Summary"
echo "========================"
echo -e "${BLUE}Environment:${NC} ${ENVIRONMENT:-development}"
echo -e "${BLUE}Auth0 Domain:${NC} ${AUTH0_DOMAIN:-not set}"
echo -e "${BLUE}API Base URL:${NC} ${API_BASE_URL:-not set}"
echo -e "${BLUE}Bundle ID:${NC} ${APPLE_APP_BUNDLE_ID:-not set}"
echo -e "${BLUE}Debug Enabled:${NC} ${DEBUG_ENABLED:-false}"

# Development options
echo ""
echo "🛠️  Development Options"
echo "======================"
echo "1. Open iOS project in Xcode"
echo "2. Start backend development server"
echo "3. Run iOS simulator"
echo "4. Show current configuration"
echo "5. Edit .env configuration"
echo "6. Exit"

read -p "Choose an option (1-6): " choice

case $choice in
    1)
        echo -e "${BLUE}🚀 Opening iOS project in Xcode...${NC}"
        open "$IOS_DIR/ParaWavePTT/ParaWavePTT.xcodeproj"
        ;;
    2)
        echo -e "${BLUE}🚀 Starting backend development server...${NC}"
        if [ -d "$PROJECT_ROOT/apps/cloudflare-worker" ]; then
            cd "$PROJECT_ROOT/apps/cloudflare-worker"
            if [ -f "package.json" ]; then
                npm run dev
            else
                echo -e "${RED}❌ package.json not found in cloudflare-worker directory${NC}"
            fi
        else
            echo -e "${RED}❌ Cloudflare worker directory not found${NC}"
        fi
        ;;
    3)
        echo -e "${BLUE}🚀 Starting iOS Simulator...${NC}"
        xcrun simctl boot "iPhone 15" 2>/dev/null || true
        open -a Simulator
        ;;
    4)
        echo -e "${BLUE}📋 Current Configuration:${NC}"
        echo "=========================="
        # Display all environment variables (masking sensitive ones)
        env | grep -E "^(AUTH0_|API_|APPLE_|ENVIRONMENT|DEBUG_)" | while IFS='=' read -r key value; do
            if [[ $key == *"SECRET"* ]] || [[ $key == *"TOKEN"* ]]; then
                echo -e "${BLUE}$key:${NC} ***MASKED***"
            else
                echo -e "${BLUE}$key:${NC} $value"
            fi
        done
        ;;
    5)
        echo -e "${BLUE}📝 Opening .env file for editing...${NC}"
        if command -v code &> /dev/null; then
            code "$PROJECT_ROOT/.env"
        elif command -v nano &> /dev/null; then
            nano "$PROJECT_ROOT/.env"
        else
            echo -e "${YELLOW}Please edit $PROJECT_ROOT/.env manually${NC}"
        fi
        ;;
    6)
        echo -e "${GREEN}👋 Goodbye!${NC}"
        exit 0
        ;;
    *)
        echo -e "${RED}❌ Invalid option${NC}"
        exit 1
        ;;
esac

echo -e "${GREEN}✅ Setup completed successfully!${NC}"
echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo "   - Use 'npm run dev' in apps/cloudflare-worker to start the backend"
echo "   - The iOS app will automatically read configuration from .env"
echo "   - Check the debug console in Xcode for configuration details"
echo "   - Environment variables take precedence over hardcoded values"