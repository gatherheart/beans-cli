import { ChatSession, type Config } from "@beans/core";

export const CODE_GEN_SYSTEM_PROMPT = `You are a Python code generator. When given a problem description, write a Python function that solves it.

Rules:
- Output ONLY the Python code, no explanations
- Use proper Python syntax and conventions
- Include the function definition
- Do not include test cases or examples`;

/** Use identical model, system prompt, and tool settings for each mode's first attempt. */
export function createCodeGenSession(config: Config): ChatSession {
  return new ChatSession(config.getLLMClient(), config.getToolRegistry(), {
    systemPrompt: CODE_GEN_SYSTEM_PROMPT,
    modelConfig: config.getLLMConfig(),
    toolConfig: { allowAllTools: false },
    runConfig: { maxTurns: 1 },
  });
}
