/**
 * Command line argument parsing
 */

/**
 * Available UI test scenarios
 */
export type UITestScenarioArg =
  | "basic"
  | "long-content"
  | "rapid-stream"
  | "tool-calls"
  | "empty-response"
  | "multi-turn"
  | "slow-stream"
  | "error";

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
  /** Plan mode - read-only, blocks write/execute operations */
  plan: boolean;
  /** Verbose output */
  verbose: boolean;
  /** Working directory */
  cwd?: string;
  /** List available models */
  listModels: boolean;
  /** Create a fine-tuning job from a local training file */
  fineTune?: string;
  /** Base model for fine-tuning */
  fineTuneModel?: string;
  /** Optional validation file for fine-tuning */
  fineTuneValidationFile?: string;
  /** Optional model suffix for fine-tuning */
  fineTuneSuffix?: string;
  /** List fine-tuning jobs */
  listFineTunes: boolean;
  /** Retrieve a fine-tuning job */
  fineTuneJob?: string;
  /** Create a localization-focused Ollama model */
  createOllamaLocalizer?: string;
  /** Base Ollama model used to build the localization model */
  ollamaBaseModel?: string;
  /** Target localization language */
  localizationLanguage?: string;
  /** Optional file with extra localization rules */
  localizationRulesFile?: string;
  /** Raw Ollama Modelfile parameters in key=value form */
  ollamaParameters?: string[];
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
  /** Run benchmark evaluation */
  eval: boolean;
  /** Benchmark name for evaluation (e.g., 'mbpp') */
  benchmark?: string;
  /** Limit number of problems to evaluate */
  limit?: number;
  /** Skip first N problems */
  offset?: number;
  /** Output file path for evaluation report */
  output?: string;
  /** Resume evaluation from a previous run */
  resume?: string;
  /** Timeout per problem in ms */
  timeout?: number;
  /** Enable agentic mode with iteration */
  agentic: boolean;
  /** Max iterations per problem in agentic mode */
  maxIterations?: number;
  /** Reuse the exact initial answers from a single-pass JSON report. */
  baselineReport?: string;
  /** Retry failed answers without a Critic agent. */
  retryWithoutCritic: boolean;
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
    plan: false,
    verbose: false,
    listModels: false,
    listFineTunes: false,
    interactive: false,
    debug: false,
    uiTest: false,
    eval: false,
    agentic: false,
    retryWithoutCritic: false,
  };

  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "-h":
      case "--help":
        result.help = true;
        break;
      case "-v":
      case "--version":
        result.version = true;
        break;
      case "-c":
      case "--continue":
        result.continue = true;
        break;
      case "-m":
      case "--model":
        result.model = args[++i];
        break;
      case "--yolo":
        result.yolo = true;
        break;
      case "--plan":
        result.plan = true;
        break;
      case "--verbose":
        result.verbose = true;
        break;
      case "--cwd":
        result.cwd = args[++i];
        break;
      case "--list-models":
        result.listModels = true;
        break;
      case "--fine-tune":
        result.fineTune = args[++i];
        break;
      case "--fine-tune-model":
        result.fineTuneModel = args[++i];
        break;
      case "--fine-tune-validation-file":
        result.fineTuneValidationFile = args[++i];
        break;
      case "--fine-tune-suffix":
        result.fineTuneSuffix = args[++i];
        break;
      case "--list-fine-tunes":
        result.listFineTunes = true;
        break;
      case "--fine-tune-job":
        result.fineTuneJob = args[++i];
        break;
      case "--create-ollama-localizer":
        result.createOllamaLocalizer = args[++i];
        break;
      case "--ollama-base-model":
        result.ollamaBaseModel = args[++i];
        break;
      case "--localization-language":
        result.localizationLanguage = args[++i];
        break;
      case "--localization-rules-file":
        result.localizationRulesFile = args[++i];
        break;
      case "--ollama-parameter":
        result.ollamaParameters ??= [];
        result.ollamaParameters.push(args[++i]);
        break;
      case "-i":
      case "--interactive":
        result.interactive = true;
        break;
      case "-a":
      case "--agent":
        result.agentDescription = args[++i];
        break;
      case "--agent-profile":
        result.agentProfile = args[++i];
        break;
      case "--debug":
        result.debug = true;
        break;
      case "--ui-test":
        result.uiTest = true;
        break;
      case "--ui-test-scenario":
        result.uiTestScenario = args[++i] as UITestScenarioArg;
        break;
      case "--eval":
        result.eval = true;
        break;
      case "--benchmark":
        result.benchmark = args[++i];
        break;
      case "--limit":
        result.limit = parseInt(args[++i], 10);
        break;
      case "--offset":
        result.offset = parseInt(args[++i], 10);
        break;
      case "--output":
        result.output = args[++i];
        break;
      case "--resume":
        result.resume = args[++i];
        break;
      case "--timeout":
        result.timeout = parseInt(args[++i], 10);
        break;
      case "--agentic":
        result.agentic = true;
        break;
      case "--max-iterations":
        result.maxIterations = parseInt(args[++i], 10);
        break;
      case "--baseline-report":
        result.baselineReport = args[++i];
        break;
      case "--blind-retry":
        result.retryWithoutCritic = true;
        break;
      default:
        if (!arg.startsWith("-")) {
          positional.push(arg);
        }
    }
  }

  if (positional.length > 0) {
    result.prompt = positional.join(" ");
  }

  return result;
}
