# Model Context Protocol (MCP) Servers Configuration

This project includes configurations for various MCP servers that can be used with AI coding assistants like Claude, Cursor, or other tools that support the Model Context Protocol.

## Available MCP Servers

1. **Cloudinary Tools** - For asset management, environment configuration, structured metadata, and analysis
2. **GitHub** - For GitHub integration
3. **Playwright** - For browser automation and testing
4. **Supabase** - For Supabase database integration
5. **Sequential Thinking** - For complex reasoning tasks
6. **n8n** - For workflow automation

## Configuration Files

The MCP configurations are stored in:
- `.cursor/mcp-settings.json` - For Cursor IDE
- `.claude/settings.local.json` - For Claude Code

## How to Use

### With Cursor IDE

1. Install Cursor IDE from https://cursor.sh
2. The MCP servers will be automatically available when you open this project
3. Access them through the AI assistant panel in Cursor

### With Claude Code

1. Install the Claude desktop app
2. Open this project folder in Claude
3. The MCP servers will be automatically available

### Manual Installation

You can also run any of the MCP servers directly from the command line:

```bash
# Sequential Thinking (complex reasoning)
npx -y @modelcontextprotocol/server-sequential-thinking

# GitHub Integration
npx -y @modelcontextprotocol/server-github

# Playwright Browser Automation
npx @playwright/mcp@latest

# Supabase Integration
npx -y @supabase/mcp-server-supabase@latest --project-ref=cqmhanqnfybyxezhobkx

# Cloudinary Tools
npx -y --package @cloudinary/asset-management -- mcp start
npx -y --package @cloudinary/environment-config -- mcp start
npx -y --package @cloudinary/structured-metadata -- mcp start
npx -y --package @cloudinary/analysis -- mcp start

# n8n Workflow Automation
npx n8n-mcp
```

## Environment Variables

Some MCP servers require environment variables to function:

- **Cloudinary services**: `CLOUDINARY_URL`
- **GitHub**: `GITHUB_PERSONAL_ACCESS_TOKEN`
- **Supabase**: `SUPABASE_ACCESS_TOKEN`
- **n8n**: `N8N_API_URL` and `N8N_API_KEY`

These are already configured in the MCP settings files.

## Testing MCP Servers

To verify that an MCP server is working correctly, you can run:

```bash
# Test Sequential Thinking
npx -y @modelcontextprotocol/server-sequential-thinking --help

# Test GitHub
npx -y @modelcontextprotocol/server-github --help

# Test Playwright
npx @playwright/mcp@latest --help
```

## Troubleshooting

If you encounter issues with MCP servers:

1. Ensure you have Node.js installed (version 18 or higher)
2. Check that your internet connection is working
3. Verify that the required environment variables are set correctly
4. Try updating the packages: `npx -y <package-name>@latest`

For any issues with specific MCP servers, check their respective documentation:
- Sequential Thinking: https://github.com/modelcontextprotocol/servers
- Playwright: https://playwright.dev/docs/mcp
- Supabase: https://supabase.com/docs/guides/ai/mcp