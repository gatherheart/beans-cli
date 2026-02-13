/**
 * Markdown renderer for terminal display using Ink
 * Inspired by gemini-cli's implementation
 */

import React from 'react';
import { Box, Text } from 'ink';
import { createLowlight, common } from 'lowlight';
import type { Element, Text as HastText, Root, RootContent } from 'hast';
import { theme } from '../theme/colors.js';
import stringWidth from 'string-width';

const lowlight = createLowlight(common);

interface MarkdownDisplayProps {
  text: string;
  width?: number;
  showLineNumbers?: boolean;
}

// Map highlight.js classes to terminal colors
const CLASS_TO_COLOR: Record<string, string> = {
  'hljs-keyword': theme.syntax.keyword,
  'hljs-built_in': theme.syntax.builtin,
  'hljs-type': theme.syntax.type,
  'hljs-literal': theme.syntax.literal,
  'hljs-number': theme.syntax.number,
  'hljs-string': theme.syntax.string,
  'hljs-comment': theme.syntax.comment,
  'hljs-doctag': theme.syntax.comment,
  'hljs-meta': theme.syntax.comment,
  'hljs-attr': theme.syntax.property,
  'hljs-attribute': theme.syntax.property,
  'hljs-name': 'blue',
  'hljs-tag': 'blue',
  'hljs-title': theme.syntax.function,
  'hljs-function': theme.syntax.function,
  'hljs-class': theme.syntax.function,
  'hljs-params': 'white',
  'hljs-variable': theme.syntax.variable,
  'hljs-regexp': theme.syntax.variable,
  'hljs-symbol': theme.syntax.variable,
  'hljs-template-variable': theme.syntax.variable,
  'hljs-selector-id': 'blue',
  'hljs-selector-class': 'blue',
  'hljs-selector-tag': 'blue',
  'hljs-property': theme.syntax.property,
  'hljs-punctuation': theme.syntax.punctuation,
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

function renderHastNode(node: RootContent, inheritedColor?: string): React.ReactNode {
  if (node.type === 'text') {
    const textNode = node as HastText;
    const color = inheritedColor || theme.text.code;
    const key = `hast-${hastKeyCounter++}`;
    return <Text key={key} color={color}>{textNode.value}</Text>;
  }

  if (node.type === 'element') {
    const element = node as Element;
    const classes = (element.properties?.className as string[]) || [];
    const elementColor = getColorFromClasses(classes);
    const colorToPassDown = elementColor || inheritedColor;
    const key = `hast-${hastKeyCounter++}`;

    const children = element.children?.map((child, idx) => (
      <React.Fragment key={`${key}-${idx}`}>
        {renderHastNode(child as RootContent, colorToPassDown)}
      </React.Fragment>
    ));

    return <React.Fragment key={key}>{children}</React.Fragment>;
  }

  return null;
}

function renderHighlightedCode(code: string, language: string | null): React.ReactNode {
  try {
    hastKeyCounter = 0;
    const result: Root = language && lowlight.registered(language)
      ? lowlight.highlight(language, code)
      : lowlight.highlightAuto(code);

    return result.children.map((child, idx) => (
      <React.Fragment key={`code-${idx}`}>
        {renderHastNode(child)}
      </React.Fragment>
    ));
  } catch {
    return <Text color={theme.text.code}>{code}</Text>;
  }
}

// ============================================
// Code Block Component
// ============================================

interface CodeBlockProps {
  code: string;
  language: string | null;
  showLineNumbers?: boolean;
}

const CodeBlockInternal: React.FC<CodeBlockProps> = ({ code, language, showLineNumbers = false }) => {
  const lines = code.split('\n');
  const padWidth = String(lines.length).length;

  return (
    <Box flexDirection="column" marginY={1}>
      {language && (
        <Text color={theme.text.secondary} dimColor> {language}</Text>
      )}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={theme.border.code}
        paddingX={1}
      >
        {lines.map((line, i) => (
          <Box key={i}>
            {showLineNumbers && (
              <Text color={theme.text.secondary}>
                {String(i + 1).padStart(padWidth, ' ')}
              </Text>
            )}
            <Text color={theme.text.code}>
              {line === '' ? ' ' : renderHighlightedCode(line, language)}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

const CodeBlock = React.memo(CodeBlockInternal);

// ============================================
// Inline Markdown Renderer
// ============================================

interface InlineProps {
  text: string;
}

/**
 * Get the plain text length of a string with markdown formatting stripped
 */
function getPlainTextLength(text: string): number {
  const cleanText = text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1');
  return stringWidth(cleanText);
}

const RenderInlineInternal: React.FC<InlineProps> = ({ text }) => {
  // Early return for plain text without markdown or URLs
  if (!/[*_~`\[<]|https?:/.test(text)) {
    return <Text color={theme.text.primary}>{text}</Text>;
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  // Combined regex for all inline styles
  const inlineRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|`[^`]+`|~~[^~]+~~|\[[^\]]+\]\([^)]+\)|<u>[^<]+<\/u>|https?:\/\/\S+)/g;
  let match: RegExpExecArray | null;

  while ((match = inlineRegex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(
        <Text key={`t-${lastIndex}`} color={theme.text.primary}>
          {text.slice(lastIndex, match.index)}
        </Text>
      );
    }

    const fullMatch = match[0];
    const key = `m-${match.index}`;
    let renderedNode: React.ReactNode = null;

    // **bold**
    if (fullMatch.startsWith('**') && fullMatch.endsWith('**') && fullMatch.length > 4) {
      renderedNode = (
        <Text key={key} bold color={theme.text.primary}>
          {fullMatch.slice(2, -2)}
        </Text>
      );
    }
    // *italic* or _italic_ (with boundary checks)
    else if (
      ((fullMatch.startsWith('*') && fullMatch.endsWith('*')) ||
       (fullMatch.startsWith('_') && fullMatch.endsWith('_'))) &&
      fullMatch.length > 2 &&
      !fullMatch.startsWith('**')
    ) {
      // Check word boundaries to avoid false positives in paths like some_var_name
      const prevChar = match.index > 0 ? text[match.index - 1] : '';
      const nextChar = text[inlineRegex.lastIndex] || '';
      const isWordBoundary = !/\w/.test(prevChar) && !/\w/.test(nextChar);

      if (isWordBoundary) {
        renderedNode = (
          <Text key={key} italic color={theme.text.primary}>
            {fullMatch.slice(1, -1)}
          </Text>
        );
      }
    }
    // `code`
    else if (fullMatch.startsWith('`') && fullMatch.endsWith('`') && fullMatch.length > 2) {
      renderedNode = (
        <Text key={key} color={theme.text.accent}>
          {fullMatch.slice(1, -1)}
        </Text>
      );
    }
    // ~~strikethrough~~
    else if (fullMatch.startsWith('~~') && fullMatch.endsWith('~~') && fullMatch.length > 4) {
      renderedNode = (
        <Text key={key} strikethrough color={theme.text.secondary}>
          {fullMatch.slice(2, -2)}
        </Text>
      );
    }
    // [text](url) - links shown as text with URL
    else if (fullMatch.startsWith('[') && fullMatch.includes('](')) {
      const linkMatch = fullMatch.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        renderedNode = (
          <Text key={key}>
            <Text color={theme.text.link} underline>{linkMatch[1]}</Text>
            <Text color={theme.text.secondary}> ({linkMatch[2]})</Text>
          </Text>
        );
      }
    }
    // <u>underline</u>
    else if (fullMatch.startsWith('<u>') && fullMatch.endsWith('</u>')) {
      renderedNode = (
        <Text key={key} underline color={theme.text.primary}>
          {fullMatch.slice(3, -4)}
        </Text>
      );
    }
    // Raw URLs
    else if (/^https?:\/\//.test(fullMatch)) {
      renderedNode = (
        <Text key={key} color={theme.text.link} underline>
          {fullMatch}
        </Text>
      );
    }

    parts.push(renderedNode ?? <Text key={key} color={theme.text.primary}>{fullMatch}</Text>);
    lastIndex = inlineRegex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(
      <Text key={`t-${lastIndex}`} color={theme.text.primary}>
        {text.slice(lastIndex)}
      </Text>
    );
  }

  return <>{parts.length > 0 ? parts : <Text color={theme.text.primary}>{text}</Text>}</>;
};

const RenderInline = React.memo(RenderInlineInternal);

// ============================================
// Table Renderer
// ============================================

interface TableProps {
  headers: string[];
  rows: string[][];
  terminalWidth?: number;
}

const TableInternal: React.FC<TableProps> = ({ headers, rows, terminalWidth = 80 }) => {
  if (headers.length === 0) return <></>;

  // Calculate column widths using display width
  const columnWidths = headers.map((header, index) => {
    const headerWidth = getPlainTextLength(header);
    const maxRowWidth = Math.max(
      0,
      ...rows.map((row) => getPlainTextLength(row[index] || ''))
    );
    return Math.max(headerWidth, maxRowWidth) + 2; // Add padding
  });

  // Scale to fit terminal width
  const totalWidth = columnWidths.reduce((sum, width) => sum + width + 1, 1);
  const scaleFactor = totalWidth > terminalWidth ? terminalWidth / totalWidth : 1;
  const adjustedWidths = columnWidths.map((width) => Math.max(3, Math.floor(width * scaleFactor)));

  // Render border
  const renderBorder = (type: 'top' | 'middle' | 'bottom'): React.ReactNode => {
    const chars = {
      top: { left: '┌', middle: '┬', right: '┐', horizontal: '─' },
      middle: { left: '├', middle: '┼', right: '┤', horizontal: '─' },
      bottom: { left: '└', middle: '┴', right: '┘', horizontal: '─' },
    };
    const char = chars[type];
    const borderParts = adjustedWidths.map((w) => char.horizontal.repeat(w));
    return <Text color={theme.border.default}>{char.left + borderParts.join(char.middle) + char.right}</Text>;
  };

  // Render cell with proper width
  const renderCell = (content: string, width: number, isHeader = false): React.ReactNode => {
    const contentWidth = Math.max(0, width - 2);
    const displayWidth = getPlainTextLength(content);
    let cellContent = content;

    if (displayWidth > contentWidth) {
      cellContent = content.substring(0, Math.max(0, contentWidth - 3)) + '...';
    }

    const actualWidth = getPlainTextLength(cellContent);
    const padding = ' '.repeat(Math.max(0, contentWidth - actualWidth));

    return (
      <Text>
        {isHeader ? (
          <Text bold color={theme.text.link}>
            <RenderInline text={cellContent} />
          </Text>
        ) : (
          <RenderInline text={cellContent} />
        )}
        {padding}
      </Text>
    );
  };

  // Render row
  const renderRow = (cells: string[], isHeader = false): React.ReactNode => (
    <Text color={theme.text.primary}>
      <Text color={theme.border.default}>│</Text>
      {cells.map((cell, index) => (
        <React.Fragment key={index}>
          <Text> </Text>
          {renderCell(cell || '', adjustedWidths[index] || 3, isHeader)}
          <Text color={theme.border.default}>│</Text>
        </React.Fragment>
      ))}
    </Text>
  );

  return (
    <Box flexDirection="column" marginY={1}>
      {renderBorder('top')}
      {renderRow(headers, true)}
      {renderBorder('middle')}
      {rows.map((row, index) => (
        <React.Fragment key={index}>{renderRow(row)}</React.Fragment>
      ))}
      {renderBorder('bottom')}
    </Box>
  );
};

const Table = React.memo(TableInternal);

// ============================================
// Main Markdown Display Component
// ============================================

const MarkdownDisplayInternal: React.FC<MarkdownDisplayProps> = ({
  text,
  width,
  showLineNumbers = false
}) => {
  if (!text) return <></>;

  const lines = text.split(/\r?\n/);
  const elements: React.ReactNode[] = [];

  // Regex patterns
  const headerRegex = /^(#{1,6})\s+(.*)$/;
  const codeFenceRegex = /^(`{3,}|~{3,})(\w*)$/;
  const ulItemRegex = /^(\s*)([-*+])\s+(.*)$/;
  const olItemRegex = /^(\s*)(\d+)\.\s+(.*)$/;
  const blockquoteRegex = /^>\s?(.*)$/;
  const hrRegex = /^(---|\*\*\*|___)$/;
  const tableRowRegex = /^\|(.+)\|$/;
  const tableSepRegex = /^\|[-:| ]+\|$/;

  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let codeBlockLang: string | null = null;
  let codeBlockFence = '';
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];
  let inTable = false;
  let lastLineEmpty = true;

  const flushTable = (key: string) => {
    if (tableHeaders.length > 0 && tableRows.length > 0) {
      elements.push(
        <Table key={key} headers={tableHeaders} rows={tableRows} terminalWidth={width} />
      );
    }
    tableHeaders = [];
    tableRows = [];
    inTable = false;
  };

  lines.forEach((line, index) => {
    const key = `line-${index}`;

    // Code fence handling
    const codeFenceMatch = line.match(codeFenceRegex);
    if (codeFenceMatch) {
      if (inCodeBlock && codeFenceMatch[1].startsWith(codeBlockFence[0]) &&
          codeFenceMatch[1].length >= codeBlockFence.length) {
        // End code block
        elements.push(
          <CodeBlock
            key={key}
            code={codeBlockLines.join('\n')}
            language={codeBlockLang}
            showLineNumbers={showLineNumbers}
          />
        );
        inCodeBlock = false;
        codeBlockLines = [];
        codeBlockLang = null;
        codeBlockFence = '';
        lastLineEmpty = false;
      } else if (!inCodeBlock) {
        // Start code block
        inCodeBlock = true;
        codeBlockFence = codeFenceMatch[1];
        codeBlockLang = codeFenceMatch[2] || null;
      }
      return;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      return;
    }

    // Table handling
    if (tableRowRegex.test(line) && !inTable) {
      // Check if next line is separator
      if (index + 1 < lines.length && tableSepRegex.test(lines[index + 1])) {
        inTable = true;
        tableHeaders = line.slice(1, -1).split('|').map(cell => cell.trim());
        return;
      }
    }

    if (inTable) {
      if (tableSepRegex.test(line)) {
        return; // Skip separator
      }
      if (tableRowRegex.test(line)) {
        const cells = line.slice(1, -1).split('|').map(cell => cell.trim());
        // Ensure row has same column count as headers
        while (cells.length < tableHeaders.length) cells.push('');
        if (cells.length > tableHeaders.length) cells.length = tableHeaders.length;
        tableRows.push(cells);
        return;
      }
      // End of table
      flushTable(`table-${index}`);
    }

    // Headers
    const headerMatch = line.match(headerRegex);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const headerText = headerMatch[2];

      let headerNode: React.ReactNode;
      if (level <= 2) {
        headerNode = (
          <Text bold color={theme.text.link}>
            <RenderInline text={headerText} />
          </Text>
        );
      } else if (level <= 4) {
        headerNode = (
          <Text bold color={theme.text.primary}>
            <RenderInline text={headerText} />
          </Text>
        );
      } else {
        headerNode = (
          <Text italic color={theme.text.secondary}>
            <RenderInline text={headerText} />
          </Text>
        );
      }
      elements.push(<Box key={key} marginY={level <= 2 ? 1 : 0}>{headerNode}</Box>);
      lastLineEmpty = false;
      return;
    }

    // Horizontal rule
    if (hrRegex.test(line)) {
      elements.push(
        <Box key={key} marginY={1}>
          <Text color={theme.text.secondary}>{'─'.repeat(Math.min(40, width || 40))}</Text>
        </Box>
      );
      lastLineEmpty = false;
      return;
    }

    // Blockquote
    const blockquoteMatch = line.match(blockquoteRegex);
    if (blockquoteMatch) {
      elements.push(
        <Box key={key} paddingLeft={1}>
          <Text color={theme.border.default}>│ </Text>
          <Text italic color={theme.text.secondary}>
            <RenderInline text={blockquoteMatch[1]} />
          </Text>
        </Box>
      );
      lastLineEmpty = false;
      return;
    }

    // Unordered list
    const ulMatch = line.match(ulItemRegex);
    if (ulMatch) {
      const indent = ulMatch[1].length;
      elements.push(
        <Box key={key} paddingLeft={indent + 1} flexDirection="row">
          <Box width={2}>
            <Text color={theme.text.link}>• </Text>
          </Box>
          <Box flexGrow={1}>
            <Text wrap="wrap" color={theme.text.primary}>
              <RenderInline text={ulMatch[3]} />
            </Text>
          </Box>
        </Box>
      );
      lastLineEmpty = false;
      return;
    }

    // Ordered list
    const olMatch = line.match(olItemRegex);
    if (olMatch) {
      const indent = olMatch[1].length;
      const num = olMatch[2];
      const prefixWidth = num.length + 2;
      elements.push(
        <Box key={key} paddingLeft={indent + 1} flexDirection="row">
          <Box width={prefixWidth}>
            <Text color={theme.text.link}>{num}. </Text>
          </Box>
          <Box flexGrow={1}>
            <Text wrap="wrap" color={theme.text.primary}>
              <RenderInline text={olMatch[3]} />
            </Text>
          </Box>
        </Box>
      );
      lastLineEmpty = false;
      return;
    }

    // Empty line
    if (!line.trim()) {
      if (!lastLineEmpty) {
        elements.push(<Box key={key} height={1} />);
        lastLineEmpty = true;
      }
      return;
    }

    // Regular paragraph
    elements.push(
      <Box key={key} width={width}>
        <Text wrap="wrap" color={theme.text.primary}>
          <RenderInline text={line} />
        </Text>
      </Box>
    );
    lastLineEmpty = false;
  });

  // Handle unclosed code block
  if (inCodeBlock && codeBlockLines.length > 0) {
    elements.push(
      <CodeBlock
        key="unclosed-code"
        code={codeBlockLines.join('\n')}
        language={codeBlockLang}
        showLineNumbers={showLineNumbers}
      />
    );
  }

  // Handle unclosed table
  if (inTable) {
    flushTable('unclosed-table');
  }

  return <Box flexDirection="column" width={width}>{elements}</Box>;
};

export const MarkdownDisplay = React.memo(MarkdownDisplayInternal);
