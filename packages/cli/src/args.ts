/**
 * Command line argument parsing
 */

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
  /** SOP (Standard Operating Procedure) to inject into the agent */
  sop?: string;
  /** Path to SOP file */
  sopFile?: string;
  /** Enable debug mode to display LLM requests and responses */
  debug: boolean;
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
      case '--sop':
        result.sop = args[++i];
        break;
      case '--sop-file':
        result.sopFile = args[++i];
        break;
      case '--debug':
        result.debug = true;
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
