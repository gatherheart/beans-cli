/**
 * Command line argument parsing
 */

/**
 * Available UI test scenarios
 */
export type UITestScenarioArg =
  | 'basic'
  | 'long-content'
  | 'rapid-stream'
  | 'tool-calls'
  | 'empty-response'
  | 'multi-turn'
  | 'slow-stream'
  | 'error';

export interface CLIArgs {
  /** Initial prompt */
  prompt?: string;
  /** Show help */
  help: boolean;
  /** Show version */
  version: boolean;
  /** Continue previous session */
  continue: boolean;
  /** Model to use */
  model?: string;
  /** Auto-approve all tool calls */
  yolo: boolean;
  /** Verbose output */
  verbose: boolean;
  /** Working directory */
  cwd?: string;
  /** List available models */
  listModels: boolean;
  /** Force interactive mode even with a prompt */
  interactive: boolean;
  /** Agent description - used to generate agent profile via LLM */
  agentDescription?: string;
  /** Path to agent profile file */
  agentProfile?: string;
  /** Enable debug mode to display LLM requests and responses */
  debug: boolean;
  /** UI test mode with mock LLM responses */
  uiTest: boolean;
  /** UI test scenario to run (requires --ui-test) */
  uiTestScenario?: UITestScenarioArg;
}

/**
 * Parse command line arguments
 */
export async function parseArgs(): Promise<CLIArgs> {
  const args = process.argv.slice(2);
  const result: CLIArgs = {
    help: false,
    version: false,
    continue: false,
    yolo: false,
    verbose: false,
    listModels: false,
    interactive: false,
    debug: false,
    uiTest: false,
  };

  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '-h':
      case '--help':
        result.help = true;
        break;
      case '-v':
      case '--version':
        result.version = true;
        break;
      case '-c':
      case '--continue':
        result.continue = true;
        break;
      case '-m':
      case '--model':
        result.model = args[++i];
        break;
      case '--yolo':
        result.yolo = true;
        break;
      case '--verbose':
        result.verbose = true;
        break;
      case '--cwd':
        result.cwd = args[++i];
        break;
      case '--list-models':
        result.listModels = true;
        break;
      case '-i':
      case '--interactive':
        result.interactive = true;
        break;
      case '-a':
      case '--agent':
        result.agentDescription = args[++i];
        break;
      case '--agent-profile':
        result.agentProfile = args[++i];
        break;
      case '--debug':
        result.debug = true;
        break;
      case '--ui-test':
        result.uiTest = true;
        break;
      case '--ui-test-scenario':
        result.uiTestScenario = args[++i] as UITestScenarioArg;
        break;
      default:
        if (!arg.startsWith('-')) {
          positional.push(arg);
        }
    }
  }

  if (positional.length > 0) {
    result.prompt = positional.join(' ');
  }

  return result;
}
