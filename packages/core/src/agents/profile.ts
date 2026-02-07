/**
 * Agent Profile - Represents an agent's identity and behavior configuration
 *
 * This module provides types and utilities for defining agent profiles that
 * can be generated dynamically using LLM or loaded from Markdown files.
 */

import type { LLMClient, ChatRequest } from '../llm/types.js';

/**
 * Agent profile containing identity and behavior configuration
 */
export interface AgentProfile {
  /** Unique identifier for the agent */
  name: string;
  /** Short display name for the agent */
  displayName: string;
  /** Brief description of what the agent does */
  description: string;
  /** The agent's purpose and goals */
  purpose: string;
  /** Complete system prompt defining agent behavior */
  systemPrompt: string;
  /** Version of the profile */
  version: string;
  /** Timestamp when the profile was created */
  createdAt: string;
}

/**
 * Configuration for building an agent profile
 */
export interface AgentProfileConfig {
  /** User's description of what the agent should do */
  description: string;
  /** Optional custom instructions to append */
  customInstructions?: string;
}

/**
 * Default agent profile when no custom profile is available
 */
export const DEFAULT_AGENT_PROFILE: AgentProfile = {
  name: 'general_assistant',
  displayName: 'General Assistant',
  description: 'A helpful AI assistant for general tasks',
  purpose: 'Help users with various tasks including coding, analysis, and problem-solving',
  systemPrompt: `You are a helpful AI assistant. You help users with various tasks including:
- Answering questions and providing information
- Analyzing data and providing insights
- Writing and editing code
- Problem-solving and brainstorming

Guidelines:
- Be concise and clear in your responses
- Ask for clarification when needed
- Provide accurate and helpful information
- Use available tools when appropriate`,
  version: '1.0.0',
  createdAt: new Date().toISOString(),
};

/**
 * Builds agent profiles using LLM
 */
export class AgentProfileBuilder {
  private llmClient: LLMClient;
  private defaultModel: string;

  constructor(llmClient: LLMClient, defaultModel: string = 'gemini-2.0-flash') {
    this.llmClient = llmClient;
    this.defaultModel = defaultModel;
  }

  /**
   * Generate an agent profile from a description using LLM
   */
  async buildProfile(config: AgentProfileConfig): Promise<AgentProfile> {
    const prompt = this.buildProfilePrompt(config);

    const request: ChatRequest = {
      messages: [
        { role: 'user', content: prompt },
      ],
      model: this.defaultModel,
      temperature: 0.7,
      maxTokens: 2048,
    };

    const response = await this.llmClient.chat(request);

    return this.parseProfileResponse(response.content || '', config);
  }

  /**
   * Build the prompt for generating an agent profile
   */
  private buildProfilePrompt(config: AgentProfileConfig): string {
    let prompt = `You are an expert at designing AI agent personalities and behaviors.

Based on the following description, create a complete agent profile.

User's Description:
${config.description}
`;

    if (config.customInstructions) {
      prompt += `
Additional Instructions:
${config.customInstructions}
`;
    }

    prompt += `
Generate a JSON response with the following structure:
{
  "name": "snake_case_identifier",
  "displayName": "Human Readable Name",
  "description": "Brief one-line description",
  "purpose": "2-3 sentences about the agent's goals and objectives",
  "systemPrompt": "Complete system prompt that defines the agent's behavior, capabilities, guidelines, and any disclaimers. This should be comprehensive."
}

Important:
- The name should be a valid identifier (snake_case, no spaces)
- The displayName should be user-friendly
- The description should be concise (under 100 characters)
- The purpose should explain what the agent is designed to do
- The systemPrompt should be detailed and actionable

Respond ONLY with valid JSON, no additional text.`;

    return prompt;
  }

  /**
   * Parse the LLM response into an AgentProfile
   */
  private parseProfileResponse(content: string, config: AgentProfileConfig): AgentProfile {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        name: parsed.name || 'custom_agent',
        displayName: parsed.displayName || 'Custom Agent',
        description: parsed.description || config.description,
        purpose: parsed.purpose || config.description,
        systemPrompt: parsed.systemPrompt || this.buildFallbackSystemPrompt(config),
        version: '1.0.0',
        createdAt: new Date().toISOString(),
      };
    } catch {
      // Fallback if parsing fails
      console.warn('Failed to parse LLM response, using fallback profile');
      return this.buildFallbackProfile(config);
    }
  }

  /**
   * Build a fallback profile when LLM generation fails
   */
  private buildFallbackProfile(config: AgentProfileConfig): AgentProfile {
    return {
      name: 'custom_agent',
      displayName: 'Custom Agent',
      description: config.description.slice(0, 100),
      purpose: config.description,
      systemPrompt: this.buildFallbackSystemPrompt(config),
      version: '1.0.0',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Build a fallback system prompt
   */
  private buildFallbackSystemPrompt(config: AgentProfileConfig): string {
    let prompt = `You are an AI assistant. ${config.description}

Your capabilities:
- Analyze information and provide insights
- Execute tasks based on user requests
- Use available tools to accomplish goals

Guidelines:
- Be helpful and accurate
- Ask for clarification when needed
- Provide clear and actionable responses`;

    if (config.customInstructions) {
      prompt += `

Additional Instructions:
${config.customInstructions}`;
    }

    return prompt;
  }
}

/**
 * Parsed frontmatter with optional extends field
 */
interface ParsedFrontmatter {
  frontmatter: Record<string, string>;
  body: string;
}

/**
 * Parse YAML frontmatter from Markdown content
 */
function parseYamlFrontmatter(content: string): ParsedFrontmatter {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!frontmatterMatch) {
    return { frontmatter: {}, body: content };
  }

  const yamlContent = frontmatterMatch[1];
  const body = frontmatterMatch[2];

  // Simple YAML parser for key: value pairs
  const frontmatter: Record<string, string> = {};
  for (const line of yamlContent.split('\n')) {
    const match = line.match(/^(\w+):\s*(.*)$/);
    if (match) {
      frontmatter[match[1]] = match[2].trim();
    }
  }

  return { frontmatter, body };
}

/**
 * Extract display name from agent name
 */
function nameToDisplayName(name: string): string {
  return name
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Resolve base profile path from extends field
 */
async function resolveBasePath(extendsValue: string, currentFilePath: string): Promise<string | null> {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');

  // Check common locations for base profiles
  const possiblePaths = [
    // Relative to current file's directory
    path.join(path.dirname(currentFilePath), extendsValue + '.md'),
    path.join(path.dirname(currentFilePath), extendsValue),
    // In plugins/bases directory (relative to project root)
    path.join(path.dirname(currentFilePath), '..', '..', 'bases', extendsValue + '.md'),
    path.join(path.dirname(currentFilePath), '..', 'bases', extendsValue + '.md'),
    // Direct path
    extendsValue.endsWith('.md') ? extendsValue : extendsValue + '.md',
  ];

  for (const possiblePath of possiblePaths) {
    try {
      await fs.access(possiblePath);
      return possiblePath;
    } catch {
      // Try next path
    }
  }

  return null;
}

/**
 * Load agent profile from a Markdown file with inheritance support
 */
export async function loadAgentProfile(filePath: string): Promise<AgentProfile> {
  const fs = await import('node:fs/promises');
  const content = await fs.readFile(filePath, 'utf-8');

  const { frontmatter } = parseYamlFrontmatter(content);

  // Check for extends field
  let basePrompt = '';
  if (frontmatter.extends) {
    const basePath = await resolveBasePath(frontmatter.extends, filePath);
    if (basePath) {
      const baseProfile = await loadAgentProfile(basePath);
      basePrompt = baseProfile.systemPrompt + '\n\n';
    }
  }

  // Parse the current profile
  const profile = parseMarkdownProfile(content);

  // Prepend base prompt if exists
  if (basePrompt) {
    profile.systemPrompt = basePrompt + profile.systemPrompt;
  }

  return profile;
}

/**
 * Parse a Markdown agent profile with YAML frontmatter
 */
export function parseMarkdownProfile(content: string): AgentProfile {
  const { frontmatter, body } = parseYamlFrontmatter(content);

  // Extract name from frontmatter
  const name = frontmatter.name || 'custom_agent';
  const description = frontmatter.description || '';

  // Use the entire Markdown body as the system prompt
  const systemPrompt = body.trim();

  // Try to extract purpose from the body (look for ## Purpose section)
  let purpose = description;
  const purposeMatch = body.match(/## Purpose\n\n([\s\S]*?)(?=\n## |$)/);
  if (purposeMatch) {
    purpose = purposeMatch[1].trim();
  }

  return {
    name,
    displayName: nameToDisplayName(name),
    description,
    purpose,
    systemPrompt,
    version: '1.0.0',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Save agent profile to a Markdown file
 */
export async function saveAgentProfile(profile: AgentProfile, filePath: string): Promise<void> {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');

  // Ensure directory exists
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  // Convert profile to Markdown format
  const markdown = `---
name: ${profile.name}
description: ${profile.description}
---

${profile.systemPrompt}
`;

  await fs.writeFile(filePath, markdown, 'utf-8');
}
