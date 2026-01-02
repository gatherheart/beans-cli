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
