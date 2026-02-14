/**
 * Tool Knowledge Base - Rich metadata for RAG-based tool selection
 *
 * Each tool has example queries, keywords, and use cases that help
 * the RAG system match user input to appropriate tools.
 */

import type { ToolKnowledge } from './types.js';

export const toolKnowledgeBase: ToolKnowledge[] = [
  {
    name: 'web_search',
    description: 'Search the web for current information, documentation, or answers',
    exampleQueries: [
      'What is the weather in Seoul?',
      'How is the weather today?',
      'What is the current stock price of Samsung?',
      'Latest news about AI',
      'How do I fix npm error ENOENT?',
      'What is the probability of Korean stock market?',
      'Search for React documentation',
      'Find information about TypeScript generics',
      'What happened in the news today?',
      'Current exchange rate USD to KRW',
      'Who won the game last night?',
      'What is the population of Korea?',
      'Look up Python best practices',
      'Search for machine learning tutorials',
      'What is the latest version of Node.js?',
    ],
    keywords: [
      'weather', 'news', 'stock', 'price', 'current', 'today', 'latest',
      'search', 'find', 'look up', 'google', 'information', 'what is',
      'who is', 'when did', 'how to', 'documentation', 'tutorial',
      'exchange rate', 'population', 'statistics', 'facts', 'data',
      'error', 'fix', 'solution', 'help', 'guide', 'reference',
      'probability', 'market', 'economy', 'finance', 'investment',
    ],
    useCases: [
      'User asks about current events or real-time information',
      'User needs to look up documentation or APIs',
      'User wants to find solutions to errors or problems',
      'User asks factual questions the agent does not know',
      'User requests research on any topic',
      'User asks about weather, stocks, news, or current affairs',
    ],
    agentTypes: ['general'],
  },
  {
    name: 'read_file',
    description: 'Read the contents of a file from the filesystem',
    exampleQueries: [
      'Show me the contents of package.json',
      'Read the README file',
      'What is in the config file?',
      'Display src/index.ts',
      'Open the .env file',
      'Check the contents of tsconfig.json',
      'Look at the main entry point',
      'Show me the test file',
    ],
    keywords: [
      'read', 'show', 'display', 'open', 'contents', 'file', 'view',
      'look at', 'check', 'what is in', 'see', 'examine', 'inspect',
    ],
    useCases: [
      'User wants to see file contents',
      'User needs to understand existing code',
      'User asks about configuration or settings',
      'User wants to review a specific file',
    ],
    agentTypes: ['general', 'explore', 'plan'],
  },
  {
    name: 'write_file',
    description: 'Write or create a file on the filesystem',
    exampleQueries: [
      'Create a new file called utils.ts',
      'Write this code to index.js',
      'Save the configuration to config.json',
      'Create a README for this project',
      'Add a new component file',
      'Write a test file',
    ],
    keywords: [
      'write', 'create', 'save', 'add', 'new file', 'generate',
      'make', 'output', 'store', 'put', 'append',
    ],
    useCases: [
      'User wants to create new files',
      'User wants to save generated content',
      'User needs to write configuration',
      'User is implementing new features',
    ],
    agentTypes: ['general'],
  },
  {
    name: 'shell',
    description: 'Execute shell commands and scripts',
    exampleQueries: [
      'Run npm install',
      'Execute the build script',
      'Run tests',
      'Git status',
      'Start the development server',
      'Install dependencies',
      'Run the linter',
      'Check Node version',
      'List running processes',
      'Deploy to production',
    ],
    keywords: [
      'run', 'execute', 'npm', 'yarn', 'git', 'command', 'terminal',
      'shell', 'bash', 'script', 'install', 'build', 'test', 'start',
      'deploy', 'process', 'docker', 'make', 'compile', 'lint',
    ],
    useCases: [
      'User wants to run commands',
      'User needs to execute scripts or builds',
      'User wants to interact with git',
      'User needs to manage packages or dependencies',
      'User wants to run tests or linters',
    ],
    agentTypes: ['general', 'bash'],
  },
  {
    name: 'glob',
    description: 'Find files matching a pattern in the filesystem',
    exampleQueries: [
      'Find all TypeScript files',
      'List all test files',
      'Show all JSON files in the project',
      'Find files named index',
      'What files are in the src directory?',
      'List all components',
      'Find configuration files',
    ],
    keywords: [
      'find', 'list', 'show', 'files', 'pattern', 'match', 'search files',
      'locate', 'discover', 'what files', 'directory', 'folder',
    ],
    useCases: [
      'User wants to find files by pattern',
      'User needs to understand project structure',
      'User is looking for specific file types',
      'User wants to list files in a directory',
    ],
    agentTypes: ['general', 'explore'],
  },
  {
    name: 'grep',
    description: 'Search for patterns or text within files',
    exampleQueries: [
      'Find where this function is defined',
      'Search for all usages of useState',
      'Where is this error message?',
      'Find all TODO comments',
      'Search for imports of lodash',
      'Find references to this class',
      'Where is this variable used?',
    ],
    keywords: [
      'search', 'find', 'where', 'grep', 'locate', 'usage', 'reference',
      'definition', 'import', 'TODO', 'FIXME', 'pattern', 'text',
      'occurrence', 'instance', 'code search',
    ],
    useCases: [
      'User wants to find code patterns',
      'User needs to locate function definitions',
      'User wants to find all usages of something',
      'User is searching for specific text in code',
    ],
    agentTypes: ['general', 'explore'],
  },
  {
    name: 'TaskCreate',
    description: 'Create a new task in the task list',
    exampleQueries: [
      'Create a task to fix the bug',
      'Add a todo item',
      'Track this work item',
      'Create a task for implementing feature X',
    ],
    keywords: [
      'task', 'create', 'add', 'todo', 'track', 'work item', 'ticket',
    ],
    useCases: [
      'User wants to track work items',
      'User needs to create task lists',
      'Complex work needs to be broken down',
    ],
    agentTypes: ['general', 'plan'],
  },
  {
    name: 'TaskUpdate',
    description: 'Update an existing task status or details',
    exampleQueries: [
      'Mark task as complete',
      'Update task status',
      'Change task description',
      'Set task to in progress',
    ],
    keywords: [
      'update', 'complete', 'done', 'status', 'progress', 'modify',
    ],
    useCases: [
      'User wants to update task status',
      'Task work is completed',
      'Task details need modification',
    ],
    agentTypes: ['general'],
  },
  {
    name: 'TaskList',
    description: 'List all tasks in the task store',
    exampleQueries: [
      'Show all tasks',
      'List pending tasks',
      'What tasks are there?',
      'Show my todo list',
    ],
    keywords: [
      'list', 'show', 'tasks', 'todos', 'pending', 'all tasks',
    ],
    useCases: [
      'User wants to see task overview',
      'User needs to check pending work',
    ],
    agentTypes: ['general'],
  },
  {
    name: 'TaskGet',
    description: 'Get details of a specific task',
    exampleQueries: [
      'Show task details',
      'Get task information',
      'What is task X about?',
    ],
    keywords: [
      'task', 'details', 'get', 'show', 'information',
    ],
    useCases: [
      'User needs task details',
      'User wants to understand a specific task',
    ],
    agentTypes: ['general'],
  },
];

/**
 * Get tool knowledge by name
 */
export function getToolKnowledge(name: string): ToolKnowledge | undefined {
  return toolKnowledgeBase.find(t => t.name === name);
}

/**
 * Get all tool knowledge entries
 */
export function getAllToolKnowledge(): ToolKnowledge[] {
  return toolKnowledgeBase;
}
