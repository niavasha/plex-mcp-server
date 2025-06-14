# Contributing to Plex MCP Server

Thank you for your interest in contributing to the Plex MCP Server! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed
- A Plex Media Server for testing
- Basic knowledge of TypeScript and the MCP protocol
- Git for version control

### Development Setup

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/niavasha/plex-mcp-server.git
   cd plex-mcp-server
   ```
3. **Install dependencies:**
   ```bash
   npm install
   ```
4. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your Plex server details
   ```
5. **Start development:**
   ```bash
   npm run dev
   ```

## 🔧 Development Workflow

### Branch Naming

Use descriptive branch names:
- `feature/add-new-endpoint` - for new features
- `fix/error-handling` - for bug fixes
- `docs/update-readme` - for documentation
- `refactor/cleanup-code` - for code improvements

### Code Style

- **TypeScript** - All code should be written in TypeScript
- **ESLint/Prettier** - Follow the existing code formatting
- **Descriptive names** - Use clear, descriptive variable and function names
- **Comments** - Add JSDoc comments for public functions
- **Error handling** - Always include proper error handling with fallbacks

### Testing Your Changes

1. **Test against multiple Plex servers** if possible (different versions, configurations)
2. **Test all functions** to ensure nothing breaks
3. **Verify MCP compatibility** with different clients
4. **Check error scenarios** - test with invalid tokens, unreachable servers, etc.

## 📝 Making Changes

### Adding New Functions

When adding new Plex API functions:

1. **Add to the tools list** in `setupToolHandlers()`
2. **Add to the switch statement** in the request handler
3. **Implement the function** with proper error handling
4. **Add fallback methods** for compatibility
5. **Update documentation**

Example structure:
```typescript
private async getNewFunction(param: string) {
  try {
    // Primary method
    const data = await this.makeRequest("/new/endpoint", { param });
    return this.formatResponse(data);
  } catch (error) {
    // Fallback method
    try {
      const fallbackData = await this.makeRequest("/alternative/endpoint");
      return this.formatResponse(fallbackData, "fallback method");
    } catch (fallbackError) {
      return this.formatErrorResponse("Feature not available", fallbackError);
    }
  }
}
```

### Improving Existing Functions

- **Maintain backward compatibility** - don't break existing API contracts
- **Add optional parameters** rather than changing existing ones
- **Improve error messages** to be more helpful
- **Add fallback methods** for better compatibility

## 🐛 Bug Reports

### Before Submitting

1. **Check existing issues** to avoid duplicates
2. **Test with latest version** of the server
3. **Verify your Plex setup** is working correctly
4. **Collect relevant information** (logs, environment, versions)

### Bug Report Template

```markdown
**Describe the Bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Configure server with '...'
2. Call function '...'
3. See error

**Expected Behavior**
What you expected to happen.

**Environment:**
- OS: [e.g. macOS, Windows, Linux]
- Node.js version: [e.g. 18.17.0]
- Plex version: [e.g. 1.40.0]
- MCP client: [e.g. Claude Desktop]

**Additional Context**
Any other context, logs, or screenshots.
```

## ✨ Feature Requests

### Guidelines

- **Check existing issues** first
- **Explain the use case** - why is this needed?
- **Consider Plex API limitations** - ensure it's technically possible
- **Think about compatibility** - will it work across different Plex setups?

### Feature Request Template

```markdown
**Feature Description**
Clear description of the feature you'd like to see.

**Use Case**
Explain why this feature would be useful and how you'd use it.

**Plex API Research**
If you know of relevant Plex API endpoints, mention them.

**Alternative Solutions**
Other ways this could be implemented or worked around.
```

## 🧪 Testing Guidelines

### Manual Testing Checklist

Before submitting a PR, test:

- [ ] All functions work with your changes
- [ ] Error handling works correctly
- [ ] Fallback methods activate when needed
- [ ] No breaking changes to existing functionality
- [ ] Works with different MCP clients
- [ ] Environment configuration works correctly

### Test Cases to Consider

- **Different Plex versions** (if possible)
- **Empty libraries** - how does it handle no content?
- **Missing permissions** - what happens with restricted access?
- **Network issues** - test with unreachable Plex server
- **Invalid parameters** - test with bad input data

## 📚 Documentation

### What to Document

- **New functions** - add to README.md function table
- **Configuration changes** - update setup instructions
- **Breaking changes** - clearly note in PR description
- **Examples** - provide usage examples for new features

### Documentation Standards

- **Clear examples** - show real usage scenarios
- **Complete instructions** - don't assume prior knowledge
- **Update all relevant files** - README.md, CONTRIBUTING.md, etc.
- **Keep it current** - remove outdated information

## 📦 Pull Request Process

### Before Submitting

1. **Test thoroughly** on your local setup
2. **Update documentation** if needed
3. **Check for TypeScript errors**: `npm run build`
4. **Review your changes** for any unintended modifications

### PR Description Template

```markdown
## Summary
Brief description of changes made.

## Type of Change
- [ ] Bug fix (non-breaking change)
- [ ] New feature (non-breaking change)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
Describe how you tested your changes:
- [ ] Tested with Plex server version: X.X.X
- [ ] Tested with MCP client: Claude Desktop
- [ ] All existing functions still work
- [ ] New functionality works as expected

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or breaking changes documented)
```

### Review Process

1. **Automated checks** will run (if configured)
2. **Manual review** by maintainers
3. **Testing** by maintainers or community
4. **Feedback incorporation** if needed
5. **Merge** when approved

## 🤝 Community Guidelines

### Code of Conduct

- **Be respectful** and inclusive
- **Help others** learn and contribute
- **Provide constructive feedback**
- **Focus on the code**, not personal attributes
- **Welcome newcomers** to the project

### Getting Help

- **GitHub Issues** - for bugs and feature requests
- **GitHub Discussions** - for questions and community chat
- **Code Review** - ask for feedback on complex changes

## 🏷️ Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):
- **MAJOR** - breaking changes
- **MINOR** - new features (backward compatible)
- **PATCH** - bug fixes (backward compatible)

### Release Notes

When releasing:
- **Document all changes** clearly
- **Highlight breaking changes**
- **Provide migration guidance** if needed
- **Thank contributors** who helped

## 📞 Questions?

If you have questions about contributing:

1. **Check existing documentation** first
2. **Search closed issues** for similar questions
3. **Open a GitHub Discussion** for general questions
4. **Open an Issue** for specific problems

Thank you for helping make Plex MCP Server better! 🎉
