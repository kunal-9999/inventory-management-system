#!/bin/bash

echo "🚀 Setting up GitHub repository for Inventory Management System"
echo "================================================================"

# Check if gh is authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ GitHub CLI not authenticated. Please run: gh auth login"
    echo "   Follow the prompts to authenticate with GitHub"
    exit 1
fi

echo "✅ GitHub CLI is authenticated"

# Create the repository
echo "📦 Creating GitHub repository..."
gh repo create inventory-management-system \
    --public \
    --description "A modern, full-stack inventory management system built with Next.js, TypeScript, and Supabase" \
    --source=. \
    --remote=origin \
    --push

if [ $? -eq 0 ]; then
    echo "✅ Repository created successfully!"
    echo "🌐 Your repository is available at: https://github.com/$(gh api user --jq .login)/inventory-management-system"
    echo ""
    echo "📋 Next steps:"
    echo "1. Visit your repository on GitHub"
    echo "2. Add collaborators if needed"
    echo "3. Set up branch protection rules"
    echo "4. Create issues for future features"
    echo "5. Set up GitHub Actions for CI/CD (optional)"
else
    echo "❌ Failed to create repository"
    exit 1
fi
