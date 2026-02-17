/**
 * Options for code extraction
 */
export interface ExtractOptions {
  /** Language hint for markdown blocks */
  language?: string;
  /** Strategy for multiple code blocks */
  strategy?: 'first' | 'last' | 'largest';
}

/**
 * Result of code extraction
 */
export interface ExtractResult {
  code: string;
  found: boolean;
  blockCount: number;
}

/**
 * Extract code from LLM response text
 *
 * Handles:
 * - Markdown code blocks (```python ... ```)
 * - Raw code without blocks
 * - Multiple code blocks (configurable strategy)
 */
export function extractCode(
  text: string,
  options: ExtractOptions = {}
): ExtractResult {
  const { language = 'python', strategy = 'last' } = options;

  // Pattern for markdown code blocks
  // Matches ```python or ``` followed by content
  const codeBlockPattern = new RegExp(
    `\`\`\`(?:${language})?\\s*\\n([\\s\\S]*?)\`\`\``,
    'gi'
  );

  const blocks: string[] = [];
  let match;

  while ((match = codeBlockPattern.exec(text)) !== null) {
    const code = match[1].trim();
    if (code) {
      blocks.push(code);
    }
  }

  // If we found code blocks, apply strategy
  if (blocks.length > 0) {
    let selectedCode: string;

    switch (strategy) {
      case 'first':
        selectedCode = blocks[0];
        break;
      case 'largest':
        selectedCode = blocks.reduce((a, b) => (a.length >= b.length ? a : b));
        break;
      case 'last':
      default:
        selectedCode = blocks[blocks.length - 1];
        break;
    }

    return {
      code: selectedCode,
      found: true,
      blockCount: blocks.length,
    };
  }

  // No markdown blocks found - try to extract raw code
  // Look for function definitions as indicators of code
  const functionPattern = /^def\s+\w+\s*\(/m;
  if (functionPattern.test(text)) {
    // Extract everything that looks like Python code
    const lines = text.split('\n');
    const codeLines: string[] = [];
    let inCode = false;

    for (const line of lines) {
      // Start capturing at function definition
      if (line.match(/^def\s+\w+\s*\(/)) {
        inCode = true;
      }

      if (inCode) {
        // Stop at obvious non-code markers
        if (
          line.match(/^(Example|Test|Output|Note|Explanation):/i) &&
          !line.startsWith(' ')
        ) {
          break;
        }
        codeLines.push(line);
      }
    }

    if (codeLines.length > 0) {
      return {
        code: codeLines.join('\n').trim(),
        found: true,
        blockCount: 0,
      };
    }
  }

  // No code found
  return {
    code: '',
    found: false,
    blockCount: 0,
  };
}

/**
 * Clean extracted code for execution
 * - Removes leading/trailing whitespace
 * - Normalizes line endings
 */
export function cleanCode(code: string): string {
  return code
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\t/g, '    ') // Convert tabs to spaces
    .trim();
}
