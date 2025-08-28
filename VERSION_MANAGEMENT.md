# Version Management Strategy

This document outlines how to maintain different versions of the Inventory Management System using Git and GitHub.

## Git Branching Strategy

### Main Branches

1. **`main`** - Production-ready code
   - Always stable and deployable
   - Contains the latest stable release
   - Protected branch (no direct pushes)

2. **`develop`** - Development integration branch
   - Contains latest development changes
   - Merged into main for releases
   - Base branch for feature development

### Feature Branches

- **`feature/feature-name`** - New features
- **`bugfix/bug-description`** - Bug fixes
- **`hotfix/urgent-fix`** - Critical production fixes

## Version Numbering (Semantic Versioning)

Format: `MAJOR.MINOR.PATCH`

- **MAJOR** - Breaking changes, major new features
- **MINOR** - New features, backward compatible
- **PATCH** - Bug fixes, backward compatible

Examples:
- `1.0.0` - Initial stable release
- `1.1.0` - New features added
- `1.1.1` - Bug fixes
- `2.0.0` - Breaking changes

## Release Process

### 1. Create Release Branch
```bash
git checkout develop
git pull origin develop
git checkout -b release/v1.0.0
```

### 2. Update Version
```bash
# Update package.json version
npm version patch  # or minor, major
```

### 3. Create Release
```bash
git checkout main
git merge release/v1.0.0
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin main --tags
```

### 4. Create GitHub Release
```bash
gh release create v1.0.0 \
  --title "Version 1.0.0" \
  --notes "Release notes here" \
  --target main
```

## Environment Management

### Development
- Use `.env.local` for local development
- Never commit sensitive data
- Use `.env.example` as template

### Staging
- Use environment variables in deployment platform
- Test with production-like data

### Production
- Use secure environment variable management
- Regular backups
- Monitoring and logging

## Database Versioning

### Schema Changes
1. Create migration scripts in `scripts/` directory
2. Version control all schema changes
3. Test migrations on staging first
4. Document breaking changes

### Example Migration Naming
```
scripts/03-add-user-roles.sql
scripts/04-update-product-schema.sql
scripts/05-add-audit-logging.sql
```

## Deployment Strategy

### Development
- Local development with hot reload
- Use `pnpm dev` for development server

### Staging
- Deploy to staging environment
- Test all features before production
- Use staging database

### Production
- Deploy to production environment
- Use production database
- Monitor performance and errors

## Backup Strategy

### Code
- GitHub repository as primary backup
- Regular commits and pushes
- Tagged releases for important milestones

### Database
- Regular Supabase backups
- Export data for local development
- Document backup procedures

## Monitoring and Maintenance

### Performance Monitoring
- Monitor application performance
- Track database query performance
- Set up error tracking

### Security Updates
- Regular dependency updates
- Security vulnerability scanning
- Keep dependencies up to date

## Useful Commands

### Branch Management
```bash
# Create feature branch
git checkout -b feature/new-feature

# Switch to develop
git checkout develop

# Merge feature
git merge feature/new-feature

# Delete feature branch
git branch -d feature/new-feature
```

### Version Management
```bash
# Check current version
npm version

# Bump version
npm version patch  # 1.0.0 -> 1.0.1
npm version minor  # 1.0.1 -> 1.1.0
npm version major  # 1.1.0 -> 2.0.0
```

### Release Management
```bash
# Create release
gh release create v1.0.0 --title "Version 1.0.0" --notes "Release notes"

# List releases
gh release list

# View release
gh release view v1.0.0
```

## Best Practices

1. **Always work on feature branches**
2. **Write meaningful commit messages**
3. **Test thoroughly before merging**
4. **Keep dependencies updated**
5. **Document all changes**
6. **Use semantic versioning**
7. **Create releases for important milestones**
8. **Backup regularly**
9. **Monitor performance**
10. **Security first**

## Emergency Procedures

### Hotfix Process
1. Create hotfix branch from main
2. Fix the critical issue
3. Test thoroughly
4. Merge to main and develop
5. Create patch release
6. Deploy immediately

### Rollback Process
1. Identify the problematic version
2. Revert to previous stable version
3. Deploy rollback
4. Investigate and fix the issue
5. Create new release with fix
