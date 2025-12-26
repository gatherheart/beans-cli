import { z } from 'zod';
import type {
  Tool,
  ToolDefinition,
  ToolExecutionResult,
  ToolExecutionOptions,
  ToolConfirmation,
  ParameterDefinition,
} from './types.js';

/**
 * Base class for implementing tools with Zod validation
 */
export abstract class BaseTool<TParams extends Record<string, unknown>>
  implements Tool<TParams>
{
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly schema: z.ZodType<TParams, z.ZodTypeDef, unknown>;

  /**
   * Display name for the tool (defaults to name)
   */
  get displayName(): string {
    return this.name;
  }

  /**
   * Get the tool definition for LLM function calling
   */
  get definition(): ToolDefinition {
    return {
      name: this.name,
      displayName: this.displayName,
      description: this.description,
      parameters: this.zodToJsonSchema(this.schema),
    };
  }

  /**
   * Validate parameters using Zod schema
   */
  validate(params: TParams): { valid: boolean; error?: string } {
    const result = this.schema.safeParse(params);
    if (result.success) {
      return { valid: true };
    }
    return {
      valid: false,
      error: result.error.issues.map((i) => i.message).join('; '),
    };
  }

  /**
   * Override to require confirmation for certain operations
   */
  getConfirmation?(params: TParams): ToolConfirmation;

  /**
   * Execute the tool - must be implemented by subclasses
   */
  abstract execute(
    params: TParams,
    options?: ToolExecutionOptions
  ): Promise<ToolExecutionResult>;

  /**
   * Convert Zod schema to JSON Schema for tool definition
   */
  protected zodToJsonSchema(schema: z.ZodType<TParams, z.ZodTypeDef, unknown>): {
    type: 'object';
    properties: Record<string, ParameterDefinition>;
    required?: string[];
  } {
    // Basic conversion - in production use zod-to-json-schema
    const shape = (schema as unknown as z.ZodObject<z.ZodRawShape>)._def.shape?.();
    const properties: Record<string, ParameterDefinition> = {};
    const required: string[] = [];

    if (shape) {
      for (const [key, value] of Object.entries(shape)) {
        const zodType = value as z.ZodTypeAny;
        properties[key] = this.zodTypeToProperty(zodType);

        // Check if required (not optional)
        if (!zodType.isOptional()) {
          required.push(key);
        }
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  private zodTypeToProperty(zodType: z.ZodTypeAny): ParameterDefinition {
    const typeName = zodType._def.typeName;

    switch (typeName) {
      case 'ZodString':
        return { type: 'string', description: zodType.description };
      case 'ZodNumber':
        return { type: 'number', description: zodType.description };
      case 'ZodBoolean':
        return { type: 'boolean', description: zodType.description };
      case 'ZodArray':
        return {
          type: 'array',
          items: this.zodTypeToProperty(zodType._def.type),
          description: zodType.description,
        };
      case 'ZodEnum':
        return {
          type: 'string',
          enum: zodType._def.values,
          description: zodType.description,
        };
      case 'ZodOptional':
        return this.zodTypeToProperty(zodType._def.innerType);
      case 'ZodDefault':
        return {
          ...this.zodTypeToProperty(zodType._def.innerType),
          default: zodType._def.defaultValue(),
        };
      default:
        return { type: 'string' };
    }
  }
}
