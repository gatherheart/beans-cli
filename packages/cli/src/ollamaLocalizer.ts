import { Config } from "@beans/core";
import { mkdir, readFile, writeFile } from "fs/promises";
import { resolve } from "path";
import { spawn } from "child_process";
import type { CLIArgs } from "./args.js";

const DEFAULT_OLLAMA_BASE_MODEL = "qwen2.5:3b";

export async function handleOllamaLocalizerCommand(
  args: CLIArgs,
): Promise<boolean> {
  if (!args.createOllamaLocalizer) {
    return false;
  }

  const config = await Config.getInstance();
  const baseModel = resolveBaseModel(config, args);
  const language = args.localizationLanguage?.trim();
  if (!language) {
    throw new Error(
      "`--localization-language` is required for `--create-ollama-localizer`.",
    );
  }
  const extraRules = args.localizationRulesFile
    ? await readFile(resolve(args.localizationRulesFile), "utf8")
    : undefined;

  const modelName = args.createOllamaLocalizer;
  const modelfileDir = resolve(process.cwd(), ".beans", "ollama", modelName);
  const modelfilePath = resolve(modelfileDir, "Modelfile");
  const modelfile = buildOllamaLocalizerModelfile({
    baseModel,
    language,
    extraRules,
    parameters: parseOllamaParameters(args.ollamaParameters),
  });

  await mkdir(modelfileDir, { recursive: true });
  await writeFile(modelfilePath, modelfile, "utf8");

  console.log(`Created Modelfile: ${modelfilePath}`);
  console.log(`Building Ollama model: ${modelName}`);
  await runOllamaCreate(modelName, modelfilePath);
  console.log("");
  console.log(`Use it with: beans --model ${modelName}`);

  return true;
}

function resolveBaseModel(config: Config, args: CLIArgs): string {
  if (args.ollamaBaseModel) {
    return args.ollamaBaseModel;
  }

  if (args.model) {
    return args.model;
  }

  const llmConfig = config.getLLMConfig();
  if (llmConfig.provider === "ollama") {
    return llmConfig.model;
  }

  return DEFAULT_OLLAMA_BASE_MODEL;
}

interface OllamaLocalizerConfig {
  baseModel: string;
  language: string;
  extraRules?: string;
  parameters?: OllamaParameter[];
}

interface OllamaParameter {
  name: string;
  value: string;
}

export function buildOllamaLocalizerModelfile(
  config: OllamaLocalizerConfig,
): string {
  const rulesSection = config.extraRules?.trim()
    ? `\nAdditional project rules:\n${config.extraRules.trim()}`
    : "";
  const parameterSection =
    config.parameters && config.parameters.length > 0
      ? config.parameters
          .map((parameter) => `PARAMETER ${parameter.name} ${parameter.value}`)
          .join("\n")
      : "PARAMETER temperature 0.2\nPARAMETER top_p 0.9";

  return `FROM ${config.baseModel}
${parameterSection}
SYSTEM """You are a localization assistant specialized in ${config.language}.

Your job is to rewrite product, UI, help-center, and marketing text into natural ${config.language}.

Rules:
- Preserve placeholders such as {name}, {{variable}}, %s, %d, HTML tags, markdown, and line breaks.
- Prefer natural product language over literal translation.
- Keep UI text concise.
- Keep terminology consistent across screens.
- Do not add explanations, notes, or translator commentary.
- If the input is already in ${config.language}, improve it only when it sounds unnatural or inconsistent.${rulesSection}
"""
`;
}

function parseOllamaParameters(
  values?: string[],
): OllamaParameter[] | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }

  return values.map((value) => {
    const separatorIndex = value.indexOf("=");
    if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
      throw new Error(
        `Invalid --ollama-parameter value: ${value}. Expected key=value.`,
      );
    }

    return {
      name: value.slice(0, separatorIndex).trim(),
      value: value.slice(separatorIndex + 1).trim(),
    };
  });
}

function runOllamaCreate(
  modelName: string,
  modelfilePath: string,
): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("ollama", ["create", modelName, "-f", modelfilePath], {
      stdio: "inherit",
    });

    child.on("error", (error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        rejectPromise(new Error("`ollama` was not found in PATH."));
        return;
      }
      rejectPromise(error);
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(new Error(`ollama create failed with exit code ${code}`));
    });
  });
}
