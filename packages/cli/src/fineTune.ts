import { Config, inferProviderFromModel } from "@beans/core";
import type {
  LLMClient,
  FineTuningJob,
  FineTuningJobEvent,
  UploadedFile,
} from "@beans/core";
import { resolve } from "path";
import type { CLIArgs } from "./args.js";

type OpenAIFineTuningClient = LLMClient &
  Required<
    Pick<
      LLMClient,
      | "uploadFile"
      | "createFineTuningJob"
      | "listFineTuningJobs"
      | "getFineTuningJob"
      | "listFineTuningEvents"
    >
  >;

export async function handleFineTuneCommand(args: CLIArgs): Promise<boolean> {
  if (!args.fineTune && !args.listFineTunes && !args.fineTuneJob) {
    return false;
  }

  const config = await Config.getInstance();
  const desiredModel = resolveFineTuneBaseModel(config, args);
  const llmConfig = config.getLLMConfig();

  config.applySessionOverrides({
    llm: {
      ...llmConfig,
      provider: "openai",
      model: desiredModel ?? llmConfig.model,
    },
  });

  const client = getOpenAIFineTuningClient(config.getLLMClient());

  if (args.fineTune) {
    await createFineTuneJob(client, args, desiredModel);
    return true;
  }

  if (args.fineTuneJob) {
    await showFineTuneJob(client, args.fineTuneJob);
    return true;
  }

  if (args.listFineTunes) {
    await listFineTuneJobs(client);
    return true;
  }

  return false;
}

function resolveFineTuneBaseModel(
  config: Config,
  args: CLIArgs,
): string | undefined {
  if (args.fineTuneModel) {
    return args.fineTuneModel;
  }

  const currentModel = config.getLLMConfig().model;
  if (
    currentModel &&
    !currentModel.startsWith("ft:") &&
    inferProviderFromModel(currentModel) === "openai"
  ) {
    return currentModel;
  }

  return undefined;
}

function getOpenAIFineTuningClient(client: LLMClient): OpenAIFineTuningClient {
  if (
    !client.uploadFile ||
    !client.createFineTuningJob ||
    !client.listFineTuningJobs ||
    !client.getFineTuningJob ||
    !client.listFineTuningEvents
  ) {
    throw new Error(
      "OpenAI fine-tuning commands are not supported by the current provider configuration.",
    );
  }

  return client as OpenAIFineTuningClient;
}

async function createFineTuneJob(
  client: OpenAIFineTuningClient,
  args: CLIArgs,
  baseModel?: string,
): Promise<void> {
  if (!baseModel) {
    throw new Error(
      "A base OpenAI model is required. Pass --fine-tune-model <model>.",
    );
  }

  const trainingPath = resolve(args.fineTune!);
  console.log(`Uploading training file: ${trainingPath}`);
  const trainingFile = await client.uploadFile({
    path: trainingPath,
    purpose: "fine-tune",
  });
  console.log(formatUploadedFile(trainingFile));

  let validationFile: UploadedFile | undefined;
  if (args.fineTuneValidationFile) {
    const validationPath = resolve(args.fineTuneValidationFile);
    console.log(`Uploading validation file: ${validationPath}`);
    validationFile = await client.uploadFile({
      path: validationPath,
      purpose: "fine-tune",
    });
    console.log(formatUploadedFile(validationFile));
  }

  const job = await client.createFineTuningJob({
    model: baseModel,
    trainingFile: trainingFile.id,
    validationFile: validationFile?.id,
    suffix: args.fineTuneSuffix,
  });

  console.log("");
  console.log("Created fine-tuning job:");
  printFineTuningJob(job);
  console.log("");
  console.log(`Track it with: beans --fine-tune-job ${job.id}`);
  if (job.fineTunedModel) {
    console.log(`Use the model with: beans --model ${job.fineTunedModel}`);
  }
}

async function listFineTuneJobs(client: OpenAIFineTuningClient): Promise<void> {
  const jobs = await client.listFineTuningJobs();
  const sortedJobs = [...jobs].sort((a, b) => b.createdAt - a.createdAt);

  if (sortedJobs.length === 0) {
    console.log("No fine-tuning jobs found.");
    return;
  }

  console.log("Fine-tuning jobs:");
  for (const job of sortedJobs) {
    const fineTunedModel = job.fineTunedModel ?? "-";
    console.log(
      `  ${job.id} | ${job.status} | base=${job.model} | fine_tuned=${fineTunedModel} | created=${formatTimestamp(job.createdAt)}`,
    );
  }
}

async function showFineTuneJob(
  client: OpenAIFineTuningClient,
  jobId: string,
): Promise<void> {
  const [job, events] = await Promise.all([
    client.getFineTuningJob(jobId),
    client.listFineTuningEvents(jobId),
  ]);

  printFineTuningJob(job);

  if (events.length === 0) {
    return;
  }

  console.log("");
  console.log("Recent events:");
  for (const event of selectRecentEvents(events)) {
    console.log(
      `  [${event.level}] ${formatTimestamp(event.createdAt)} ${event.message}`,
    );
  }
}

function printFineTuningJob(job: FineTuningJob): void {
  console.log(`  Job ID: ${job.id}`);
  console.log(`  Status: ${job.status}`);
  console.log(`  Base model: ${job.model}`);
  console.log(`  Fine-tuned model: ${job.fineTunedModel ?? "-"}`);
  console.log(`  Training file: ${job.trainingFile}`);
  console.log(`  Validation file: ${job.validationFile ?? "-"}`);
  console.log(`  Created: ${formatTimestamp(job.createdAt)}`);
  console.log(`  Finished: ${formatTimestamp(job.finishedAt)}`);
  console.log(`  Estimated finish: ${formatTimestamp(job.estimatedFinish)}`);
  console.log(`  Trained tokens: ${job.trainedTokens ?? "-"}`);
  if (job.suffix) {
    console.log(`  Suffix: ${job.suffix}`);
  }
  if (job.error?.message) {
    console.log(`  Error: ${job.error.message}`);
  }
}

function formatUploadedFile(file: UploadedFile): string {
  return `Uploaded ${file.filename} as ${file.id} (${file.bytes} bytes)`;
}

function selectRecentEvents(
  events: FineTuningJobEvent[],
): FineTuningJobEvent[] {
  return [...events].sort((a, b) => a.createdAt - b.createdAt).slice(-10);
}

function formatTimestamp(value?: number | null): string {
  if (!value) {
    return "-";
  }

  return new Date(value * 1000).toLocaleString();
}
