# Security Policy

## 🔒 Reporting Security Vulnerabilities

The Plex MCP Server team takes security seriously. We appreciate your efforts to responsibly disclose your findings, and will make every effort to acknowledge your contributions.

### 🚨 Supported Versions

We actively support the following versions with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | ✅ Yes             |
| < 1.0   | ❌ No              |

### 📢 How to Report a Security Vulnerability

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report security vulnerabilities through one of the following methods:

#### 🔐 Preferred Method: GitHub Security Advisories
1. Go to the [Security tab](https://github.com/niavasha/plex-mcp-server/security) of this repository
2. Click "Report a vulnerability"
3. Fill out the security advisory form with details

#### 📧 Alternative Method: Email
Send an email to: **security@harrymanley.com** (or your preferred security contact)

Include the following information:
- Type of issue (e.g. buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### ⏱️ Response Timeline

- **Initial Response**: Within 48 hours of report
- **Detailed Response**: Within 7 days with assessment and timeline
- **Resolution**: Varies based on complexity and severity

### 🔍 What We Look For

We're particularly interested in vulnerabilities in these areas:

#### **High Priority**
- **Authentication bypass** - Circumventing Plex token validation
- **Authorization issues** - Accessing data without proper permissions
- **Remote code execution** - Running arbitrary code on the server
- **Injection attacks** - SQL injection, command injection, etc.
- **Sensitive data exposure** - Leaking Plex tokens, user data, or server info

#### **Medium Priority**
- **Cross-site scripting (XSS)** - If web interface is added
- **Denial of Service** - Causing server crashes or resource exhaustion
- **Information disclosure** - Leaking non-sensitive system information
- **Insecure defaults** - Default configurations that create security risks

#### **Lower Priority**
- **Rate limiting issues** - API abuse potential
- **Input validation** - Malformed data handling
- **Logging issues** - Sensitive data in logs

### 🛡️ Security Measures in Place

Our current security implementations include:

#### **Authentication & Authorization**
- ✅ Plex token-based authentication
- ✅ Environment variable token storage
- ✅ No token logging or persistence
- ✅ Secure token transmission to Plex servers

#### **Input Validation**
- ✅ TypeScript type checking
- ✅ Parameter validation for all functions
- ✅ Sanitized error messages
- ✅ Request size limiting

#### **Network Security**
- ✅ HTTPS communication with Plex servers
- ✅ Local network communication by default
- ✅ No external data transmission
- ✅ Configurable server endpoints

#### **Code Security**
- ✅ Dependency vulnerability scanning
- ✅ No eval() or dynamic code execution
- ✅ Minimal external dependencies
- ✅ Regular security audits

### 🔧 Security Configuration Best Practices

#### **For Users**
```bash
# Use environment variables (never hardcode tokens)
PLEX_TOKEN=your_secure_token_here

# Restrict network access
PLEX_URL=http://localhost:32400  # Use localhost when possible

# Use strong Plex passwords
# Enable two-factor authentication on Plex account
# Regularly rotate Plex tokens
```

#### **For Developers**
```typescript
// Always validate input parameters
if (!ratingKey || typeof ratingKey !== 'string') {
  throw new McpError(ErrorCode.InvalidRequest, "Invalid rating key");
}

// Never log sensitive information
console.log(`Processing request for library ${libraryKey}`); // ✅ Safe
console.log(`Token: ${token}`); // ❌ Never do this

// Use secure HTTP practices
const response = await axios.get(url, {
  headers: {
    "X-Plex-Token": this.plexConfig.token, // ✅ Header-based auth
    "Accept": "application/json"
  },
  timeout: 10000 // ✅ Reasonable timeout
});
```

### 🚫 Out of Scope

The following are generally considered out of scope:

- **Plex Media Server vulnerabilities** - Report these to Plex directly
- **MCP protocol vulnerabilities** - Report these to Anthropic
- **Client-side vulnerabilities** - Issues with Claude Desktop or other MCP clients
- **Social engineering attacks**
- **Physical attacks**
- **DoS attacks requiring excessive resources**
- **Issues in dependencies** - Unless we can reasonably mitigate them

### 🏆 Recognition

We believe in recognizing security researchers who help improve our security:

- **Security Hall of Fame** - Public recognition on our security page
- **CVE Assignment** - For qualifying vulnerabilities
- **Coordinated Disclosure** - Work with you on public disclosure timeline
- **Open Source Contribution** - Credit in CHANGELOG and release notes

*Note: We do not offer monetary bounties at this time, but we deeply appreciate responsible disclosure.*

### 📝 Disclosure Policy

- **Coordinated Disclosure**: We prefer coordinated disclosure and will work with you on timing
- **Public Disclosure**: After a fix is released, we'll publish details (with your permission)
- **CVE Assignment**: We'll request CVEs for qualifying vulnerabilities
- **Credit**: You'll be credited in security advisories and release notes (unless you prefer anonymity)

### 🔄 Security Update Process

When a security vulnerability is confirmed:

1. **Immediate Assessment** - Severity and impact evaluation
2. **Fix Development** - Priority development of security patch
3. **Testing** - Thorough testing of the fix
4. **Release** - Emergency release for critical issues, or included in next regular release
5. **Notification** - Security advisory published
6. **Documentation** - Update security documentation and best practices

### 📚 Additional Security Resources

#### **For Plex Security**
- [Plex Security Best Practices](https://support.plex.tv/articles/200250347-plex-security/)
- [Plex Security Reporting](https://www.plex.tv/security/)

#### **For MCP Security**
- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [Claude Desktop Security](https://support.anthropic.com/)

#### **General Security**
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [TypeScript Security](https://www.typescriptlang.org/docs/handbook/security.html)

### 🤝 Security Community

We encourage security researchers to:

- **Follow responsible disclosure practices**
- **Provide detailed, actionable reports**
- **Allow reasonable time for fixes**
- **Coordinate with us on disclosure timing**

### ⚖️ Legal

- **Safe Harbor** - We will not pursue legal action against researchers who follow this policy
- **Good Faith** - Security research must be conducted in good faith
- **No Harm** - Do not access, modify, or delete data belonging to others
- **Compliance** - Follow all applicable laws and regulations

---

## 📞 Contact Information

- **Security Email**: security@harrymanley.com
- **GitHub Security**: [Security Advisories](https://github.com/niavasha/plex-mcp-server/security)
- **General Contact**: [GitHub Issues](https://github.com/niavasha/plex-mcp-server/issues) (for non-security issues only)

**Last Updated**: 2025-06-14  
**Policy Version**: 1.0

---

*This security policy is inspired by industry best practices and will be updated as the project evolves.*
