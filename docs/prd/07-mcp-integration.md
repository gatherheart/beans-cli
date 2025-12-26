# PRD: MCP Integration

## Overview

MCP (Model Context Protocol) Integration enables Beans Agent to connect with external tool servers, extending its capabilities beyond built-in tools. MCP provides a standardized protocol for AI agents to interact with external services.

## Problem Statement

The built-in tool set is limited. Users need to:
- Connect to custom data sources
- Use specialized tools (databases, APIs)
- Integrate with existing infrastructure
- Extend the agent without modifying core code

MCP provides a standard way to do this.

## Goals

- **G1**: Connect to MCP servers as tool providers
- **G2**: Discover and expose MCP tools to the agent
- **G3**: Handle MCP authentication flows
- **G4**: Support both local and remote MCP servers
- **G5**: Enable easy MCP server configuration

## Non-Goals

- Building an MCP server (users provide their own)
- MCP sampling (prompt injection from servers)
- MCP resources (file-like access patterns)

---

## Functional Requirements

### FR1: MCP Client

**Description**: Connect to MCP servers using the protocol.

**Specification**:
```typescript
interface MCPClient {
  connect(server: MCPServerConfig): Promise<void>;
  disconnect(): Promise<void>;

  listTools(): Promise<MCPToolDefinition[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult>;

  isConnected(): boolean;
  getServerInfo(): MCPServerInfo;
}
```

**Transport Types**:
- `stdio`: Local process with stdin/stdout
- `http`: HTTP/SSE server
- `websocket`: WebSocket server

**Acceptance Criteria**:
- [ ] Connects via stdio transport
- [ ] Discovers available tools
- [ ] Calls tools and gets results
- [ ] Handles disconnection gracefully

### FR2: Server Configuration

**Description**: Configure MCP servers to connect to.

**Specification**:
```typescript
interface MCPServerConfig {
  name: string;
  transport: 'stdio' | 'http' | 'websocket';

  // For stdio
  command?: string;
  args?: string[];
  env?: Record<string, string>;

  // For http/websocket
  url?: string;
  headers?: Record<string, string>;
}
```

**Configuration Sources**:
- Project: `.beans/mcp.json`
- User: `~/.config/beans-agent/mcp.json`
- CLI: `--mcp-server` flag

**Acceptance Criteria**:
- [ ] Config files parsed correctly
- [ ] Multiple servers supported
- [ ] CLI override works
- [ ] Invalid config reported clearly

### FR3: Tool Discovery

**Description**: Discover and register MCP tools.

**Specification**:
```typescript
interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  serverName: string;
}
```

**Discovery Flow**:
1. Connect to MCP server
2. Call `tools/list`
3. Convert to internal ToolDefinition
4. Register in ToolRegistry with namespace

**Acceptance Criteria**:
- [ ] Tools discovered on connect
- [ ] Schema converted correctly
- [ ] Tools namespaced by server
- [ ] Refresh on reconnect

### FR4: Tool Execution

**Description**: Execute MCP tools through the protocol.

**Specification**:
```typescript
// MCP tool call
{
  method: 'tools/call',
  params: {
    name: 'tool_name',
    arguments: { ... }
  }
}

// MCP tool result
{
  content: [
    { type: 'text', text: '...' }
  ],
  isError?: boolean
}
```

**Acceptance Criteria**:
- [ ] Arguments serialized correctly
- [ ] Results parsed properly
- [ ] Errors handled gracefully
- [ ] Timeout on long calls

### FR5: Authentication

**Description**: Handle MCP server authentication.

**Auth Methods**:
- None (local servers)
- API Key (header-based)
- OAuth (browser flow)
- Token file

**Specification**:
```typescript
interface MCPAuthConfig {
  type: 'none' | 'api_key' | 'oauth' | 'token_file';

  // For api_key
  headerName?: string;
  apiKey?: string;

  // For oauth
  authUrl?: string;
  tokenUrl?: string;
  clientId?: string;

  // For token_file
  tokenPath?: string;
}
```

**Acceptance Criteria**:
- [ ] API key auth works
- [ ] OAuth flow supported
- [ ] Tokens stored securely
- [ ] Refresh tokens handled

### FR6: Connection Management

**Description**: Manage MCP server connections.

**Lifecycle**:
1. Connect on startup (configured servers)
2. Reconnect on failure
3. Disconnect on shutdown
4. Health checks

**Specification**:
```typescript
class MCPClientManager {
  async connectAll(): Promise<void>;
  async disconnect(serverName: string): Promise<void>;
  async disconnectAll(): Promise<void>;

  getClient(serverName: string): MCPClient | undefined;
  getConnectedServers(): string[];

  async refresh(serverName: string): Promise<void>;
}
```

**Acceptance Criteria**:
- [ ] Auto-connect configured servers
- [ ] Reconnect on transient failures
- [ ] Clean disconnect
- [ ] Status reporting

### FR7: Tool Namespacing

**Description**: Namespace MCP tools to avoid conflicts.

**Naming Convention**:
- Built-in: `read_file`, `shell`
- MCP: `mcp_servername_toolname`
- Display: `servername:toolname`

**Acceptance Criteria**:
- [ ] No naming conflicts
- [ ] Clear tool origin
- [ ] Short names for display
- [ ] Full names for execution

---

## Non-Functional Requirements

### NFR1: Performance

- Connection < 1 second
- Tool call overhead < 50ms
- Parallel server connections

### NFR2: Reliability

- Reconnection with backoff
- Graceful degradation
- Timeout handling

### NFR3: Security

- No arbitrary command execution
- Secure token storage
- Server validation

---

## Technical Design

### MCP Protocol

MCP uses JSON-RPC 2.0 over various transports:

```typescript
// Request
{
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/list',
  params: {}
}

// Response
{
  jsonrpc: '2.0',
  id: 1,
  result: {
    tools: [...]
  }
}
```

### Transport Implementations

#### Stdio Transport

```typescript
class StdioTransport {
  constructor(command: string, args: string[], env: Record<string, string>);

  async start(): Promise<void>;
  async send(message: object): Promise<void>;
  onMessage(handler: (message: object) => void): void;
  async stop(): Promise<void>;
}
```

#### HTTP Transport

```typescript
class HttpTransport {
  constructor(url: string, headers: Record<string, string>);

  async connect(): Promise<void>;
  async send(message: object): Promise<object>;
  async disconnect(): Promise<void>;
}
```

### MCP Tool Wrapper

```typescript
class MCPToolWrapper implements Tool {
  constructor(
    private client: MCPClient,
    private definition: MCPToolDefinition
  );

  get definition(): ToolDefinition {
    return {
      name: `mcp_${this.definition.serverName}_${this.definition.name}`,
      description: this.definition.description,
      parameters: this.definition.inputSchema,
    };
  }

  async execute(params: Record<string, unknown>): Promise<ToolExecutionResult> {
    const result = await this.client.callTool(this.definition.name, params);
    return {
      content: result.content.map(c => c.text).join('\n'),
      isError: result.isError,
    };
  }
}
```

---

## Configuration Example

```json
{
  "servers": {
    "database": {
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "DATABASE_URL": "postgresql://localhost/mydb"
      }
    },
    "github": {
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "custom-api": {
      "transport": "http",
      "url": "https://api.example.com/mcp",
      "auth": {
        "type": "api_key",
        "headerName": "X-API-Key",
        "apiKey": "${CUSTOM_API_KEY}"
      }
    }
  }
}
```

---

## Testing Strategy

### Unit Tests

- Protocol message formatting
- Tool definition conversion
- Namespace generation

### Integration Tests

- Mock MCP server
- Connection lifecycle
- Tool execution flow

### E2E Tests

- Real MCP server (postgres, filesystem)
- Auth flows
- Error scenarios

---

## Dependencies

- `@modelcontextprotocol/sdk` - MCP client SDK
- No additional deps for protocol

---

## Future Enhancements

1. **MCP Resources**: Access file-like resources
2. **MCP Sampling**: Allow server prompts (with security)
3. **Server Registry**: Discover public MCP servers
4. **Hot Reload**: Add/remove servers without restart
5. **Server UI**: Visual server management
