/**
 * Markdown renderer for terminal display using Ink
 */

import React from 'react';
import { Box, Text } from 'ink';
import { createLowlight, common } from 'lowlight';
import type { Element, Text as HastText, Root, RootContent } from 'hast';

const lowlight = createLowlight(common);

interface MarkdownDisplayProps {
  text: string;
}

// Map highlight.js classes to terminal colors
const CLASS_TO_COLOR: Record<string, string> = {
  'hljs-keyword': 'magenta',
  'hljs-built_in': 'cyan',
  'hljs-type': 'cyan',
  'hljs-literal': 'blue',
  'hljs-number': 'yellow',
  'hljs-string': 'green',
  'hljs-comment': 'gray',
  'hljs-doctag': 'gray',
  'hljs-meta': 'gray',
  'hljs-attr': 'cyan',
  'hljs-attribute': 'cyan',
  'hljs-name': 'blue',
  'hljs-tag': 'blue',
  'hljs-title': 'yellow',
  'hljs-function': 'yellow',
  'hljs-class': 'yellow',
  'hljs-params': 'white',
  'hljs-variable': 'red',
  'hljs-regexp': 'red',
  'hljs-symbol': 'red',
  'hljs-template-variable': 'red',
  'hljs-selector-id': 'blue',
  'hljs-selector-class': 'blue',
  'hljs-selector-tag': 'blue',
  'hljs-property': 'cyan',
  'hljs-punctuation': 'white',
};

function getColorFromClasses(classes: string[]): string | undefined {
  for (const cls of classes) {
    if (CLASS_TO_COLOR[cls]) {
      return CLASS_TO_COLOR[cls];
    }
  }
  return undefined;
}

let hastKeyCounter = 0;

function renderHastNode(node: RootContent): React.ReactNode {
  if (node.type === 'text') {
    const textNode = node as HastText;
    return textNode.value;
  }

  if (node.type === 'element') {
    const element = node as Element;
    const classes = (element.properties?.className as string[]) || [];
    const color = getColorFromClasses(classes);
    const key = `hast-${hastKeyCounter++}`;

    const children = element.children?.map((child) => renderHastNode(child));

    if (color) {
      return <Text key={key} color={color}>{children}</Text>;
    }
    return <React.Fragment key={key}>{children}</React.Fragment>;
  }

  return null;
}

function renderHighlightedCode(code: string, language: string | null): React.ReactNode {
  try {
    hastKeyCounter = 0; // Reset counter for each code block
    const result: Root = language
      ? lowlight.highlight(language, code)
      : lowlight.highlightAuto(code);

    return result.children.map((child) => renderHastNode(child));
  } catch {
    // Fallback to plain text if highlighting fails
    return <Text>{code}</Text>;
  }
}

interface CodeBlockProps {
  code: string;
  language: string | null;
}

function CodeBlock({ code, language }: CodeBlockProps): React.ReactElement {
  const lines = code.split('\n');

  return (
    <Box flexDirection="column" marginY={1} paddingLeft={2}>
      {language && (
        <Text color="gray" dimColor>{language}</Text>
      )}
      <Box borderStyle="round" borderColor="gray" paddingX={1}>
        <Box flexDirection="column">
          {lines.map((line, i) => (
            <Text key={i}>{renderHighlightedCode(line, language)}</Text>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

interface InlineProps {
  text: string;
}

function RenderInline({ text }: InlineProps): React.ReactElement {
  // Match: **bold**, *italic*, `code`, ~~strikethrough~~
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  // Combined regex for all inline styles
  const inlineRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|~~[^~]+~~)/g;
  let match: RegExpExecArray | null;

  while ((match = inlineRegex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const fullMatch = match[0];

    // **bold**
    if (fullMatch.startsWith('**') && fullMatch.endsWith('**')) {
      parts.push(
        <Text key={match.index} bold>{fullMatch.slice(2, -2)}</Text>
      );
    }
    // *italic*
    else if (fullMatch.startsWith('*') && fullMatch.endsWith('*')) {
      parts.push(
        <Text key={match.index} italic>{fullMatch.slice(1, -1)}</Text>
      );
    }
    // `code`
    else if (fullMatch.startsWith('`') && fullMatch.endsWith('`')) {
      parts.push(
        <Text key={match.index} backgroundColor="gray" color="white">{fullMatch.slice(1, -1)}</Text>
      );
    }
    // ~~strikethrough~~
    else if (fullMatch.startsWith('~~') && fullMatch.endsWith('~~')) {
      parts.push(
        <Text key={match.index} strikethrough>{fullMatch.slice(2, -2)}</Text>
      );
    }

    lastIndex = inlineRegex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts.length > 0 ? parts : text}</>;
}

export const MarkdownDisplay = React.memo(function MarkdownDisplay({ text }: MarkdownDisplayProps): React.ReactElement {
  const lines = text.split(/\r?\n/);
  const elements: React.ReactNode[] = [];

  // Regex patterns
  const headerRegex = /^(#{1,6})\s+(.*)$/;
  const codeFenceRegex = /^```(\w*)$/;
  const ulItemRegex = /^(\s*)([-*+])\s+(.*)$/;
  const olItemRegex = /^(\s*)(\d+)\.\s+(.*)$/;
  const blockquoteRegex = /^>\s?(.*)$/;
  const hrRegex = /^(---|\*\*\*|___)$/;

  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let codeBlockLang: string | null = null;

  lines.forEach((line, index) => {
    const key = `line-${index}`;

    // Code fence handling
    const codeFenceMatch = line.match(codeFenceRegex);
    if (codeFenceMatch) {
      if (inCodeBlock) {
        // End code block
        elements.push(
          <CodeBlock key={key} code={codeBlockLines.join('\n')} language={codeBlockLang} />
        );
        inCodeBlock = false;
        codeBlockLines = [];
        codeBlockLang = null;
      } else {
        // Start code block
        inCodeBlock = true;
        codeBlockLang = codeFenceMatch[1] || null;
      }
      return;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      return;
    }

    // Headers
    const headerMatch = line.match(headerRegex);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const headerText = headerMatch[2];

      if (level <= 2) {
        elements.push(
          <Box key={key} marginY={1}>
            <Text bold color="cyan"><RenderInline text={headerText} /></Text>
          </Box>
        );
      } else if (level <= 4) {
        elements.push(
          <Box key={key} marginTop={1}>
            <Text bold><RenderInline text={headerText} /></Text>
          </Box>
        );
      } else {
        elements.push(
          <Box key={key}>
            <Text italic><RenderInline text={headerText} /></Text>
          </Box>
        );
      }
      return;
    }

    // Horizontal rule
    if (hrRegex.test(line)) {
      elements.push(
        <Box key={key} marginY={1}>
          <Text color="gray">{'─'.repeat(40)}</Text>
        </Box>
      );
      return;
    }

    // Blockquote
    const blockquoteMatch = line.match(blockquoteRegex);
    if (blockquoteMatch) {
      elements.push(
        <Box key={key} paddingLeft={2}>
          <Text color="gray">│ </Text>
          <Text italic color="gray"><RenderInline text={blockquoteMatch[1]} /></Text>
        </Box>
      );
      return;
    }

    // Unordered list
    const ulMatch = line.match(ulItemRegex);
    if (ulMatch) {
      const indent = ulMatch[1].length;
      elements.push(
        <Box key={key} paddingLeft={indent + 2}>
          <Text color="cyan">• </Text>
          <Text><RenderInline text={ulMatch[3]} /></Text>
        </Box>
      );
      return;
    }

    // Ordered list
    const olMatch = line.match(olItemRegex);
    if (olMatch) {
      const indent = olMatch[1].length;
      const num = olMatch[2];
      elements.push(
        <Box key={key} paddingLeft={indent + 2}>
          <Text color="cyan">{num}. </Text>
          <Text><RenderInline text={olMatch[3]} /></Text>
        </Box>
      );
      return;
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<Box key={key} height={1} />);
      return;
    }

    // Regular paragraph
    elements.push(
      <Box key={key}>
        <Text wrap="wrap"><RenderInline text={line} /></Text>
      </Box>
    );
  });

  // Handle unclosed code block
  if (inCodeBlock && codeBlockLines.length > 0) {
    elements.push(
      <CodeBlock key="unclosed-code" code={codeBlockLines.join('\n')} language={codeBlockLang} />
    );
  }

  return <Box flexDirection="column">{elements}</Box>;
});
