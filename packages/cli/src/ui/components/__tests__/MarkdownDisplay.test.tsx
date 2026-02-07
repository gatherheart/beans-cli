import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { MarkdownDisplay } from '../MarkdownDisplay.js';

describe('MarkdownDisplay', () => {
  describe('headers', () => {
    it('renders h1 headers', () => {
      const { lastFrame } = render(<MarkdownDisplay text="# Hello World" width={80} />);
      expect(lastFrame()).toContain('Hello World');
    });

    it('renders h2 headers', () => {
      const { lastFrame } = render(<MarkdownDisplay text="## Section Title" width={80} />);
      expect(lastFrame()).toContain('Section Title');
    });

    it('renders multiple header levels', () => {
      const text = `# H1
## H2
### H3`;
      const { lastFrame } = render(<MarkdownDisplay text={text} width={80} />);
      const frame = lastFrame()!;
      expect(frame).toContain('H1');
      expect(frame).toContain('H2');
      expect(frame).toContain('H3');
    });
  });

  describe('code blocks', () => {
    it('renders code blocks with language label', () => {
      const text = '```typescript\nconst x = 1;\n```';
      const { lastFrame } = render(<MarkdownDisplay text={text} width={80} />);
      const frame = lastFrame()!;
      expect(frame).toContain('typescript');
      expect(frame).toContain('const');
      expect(frame).toContain('╭');
      expect(frame).toContain('╰');
    });

    it('renders code blocks without language', () => {
      const text = '```\nplain code\n```';
      const { lastFrame } = render(<MarkdownDisplay text={text} width={80} />);
      const frame = lastFrame()!;
      expect(frame).toContain('plain code');
      expect(frame).toContain('╭');
    });

    it('renders multi-line code blocks', () => {
      const text = `\`\`\`javascript
function hello() {
  console.log('world');
}
\`\`\``;
      const { lastFrame } = render(<MarkdownDisplay text={text} width={80} />);
      const frame = lastFrame()!;
      expect(frame).toContain('function hello');
      expect(frame).toContain('console.log');
    });

    it('handles unclosed code blocks gracefully', () => {
      const text = '```python\ndef foo():';
      const { lastFrame } = render(<MarkdownDisplay text={text} width={80} />);
      const frame = lastFrame()!;
      expect(frame).toContain('def foo');
    });
  });

  describe('inline formatting', () => {
    it('renders bold text', () => {
      const { lastFrame } = render(<MarkdownDisplay text="This is **bold** text" width={80} />);
      expect(lastFrame()).toContain('bold');
    });

    it('renders italic text', () => {
      const { lastFrame } = render(<MarkdownDisplay text="This is *italic* text" width={80} />);
      expect(lastFrame()).toContain('italic');
    });

    it('renders inline code', () => {
      const { lastFrame } = render(<MarkdownDisplay text="Use `const` keyword" width={80} />);
      expect(lastFrame()).toContain('const');
    });

    it('renders mixed inline formatting', () => {
      const text = '**Bold** and *italic* with `code`';
      const { lastFrame } = render(<MarkdownDisplay text={text} width={80} />);
      const frame = lastFrame()!;
      expect(frame).toContain('Bold');
      expect(frame).toContain('italic');
      expect(frame).toContain('code');
    });

    it('renders strikethrough text', () => {
      const { lastFrame } = render(<MarkdownDisplay text="~~deleted~~" width={80} />);
      expect(lastFrame()).toContain('deleted');
    });

    it('renders links', () => {
      const { lastFrame } = render(<MarkdownDisplay text="[Click here](https://example.com)" width={80} />);
      expect(lastFrame()).toContain('Click here');
    });
  });

  describe('lists', () => {
    it('renders unordered lists with dash', () => {
      const text = `- Item 1
- Item 2
- Item 3`;
      const { lastFrame } = render(<MarkdownDisplay text={text} width={80} />);
      const frame = lastFrame()!;
      expect(frame).toContain('•');
      expect(frame).toContain('Item 1');
      expect(frame).toContain('Item 2');
    });

    it('renders unordered lists with asterisk', () => {
      const text = `* First
* Second`;
      const { lastFrame } = render(<MarkdownDisplay text={text} width={80} />);
      const frame = lastFrame()!;
      expect(frame).toContain('•');
      expect(frame).toContain('First');
    });

    it('renders ordered lists', () => {
      const text = `1. First item
2. Second item
3. Third item`;
      const { lastFrame } = render(<MarkdownDisplay text={text} width={80} />);
      const frame = lastFrame()!;
      expect(frame).toContain('1.');
      expect(frame).toContain('2.');
      expect(frame).toContain('First item');
    });

    it('renders nested lists', () => {
      const text = `- Parent
  - Child`;
      const { lastFrame } = render(<MarkdownDisplay text={text} width={80} />);
      const frame = lastFrame()!;
      expect(frame).toContain('Parent');
      expect(frame).toContain('Child');
    });
  });

  describe('blockquotes', () => {
    it('renders blockquotes', () => {
      const { lastFrame } = render(<MarkdownDisplay text="> This is a quote" width={80} />);
      const frame = lastFrame()!;
      expect(frame).toContain('│');
      expect(frame).toContain('This is a quote');
    });

    it('renders multi-line blockquotes', () => {
      const text = `> Line one
> Line two`;
      const { lastFrame } = render(<MarkdownDisplay text={text} width={80} />);
      const frame = lastFrame()!;
      expect(frame).toContain('Line one');
      expect(frame).toContain('Line two');
    });
  });

  describe('horizontal rules', () => {
    it('renders horizontal rule with dashes', () => {
      const { lastFrame } = render(<MarkdownDisplay text="---" width={80} />);
      expect(lastFrame()).toContain('─');
    });

    it('renders horizontal rule with asterisks', () => {
      const { lastFrame } = render(<MarkdownDisplay text="***" width={80} />);
      expect(lastFrame()).toContain('─');
    });
  });

  describe('tables', () => {
    it('renders simple tables', () => {
      const text = `| Name | Age |
|------|-----|
| John | 30  |
| Jane | 25  |`;
      const { lastFrame } = render(<MarkdownDisplay text={text} width={80} />);
      const frame = lastFrame()!;
      expect(frame).toContain('Name');
      expect(frame).toContain('Age');
      expect(frame).toContain('John');
      expect(frame).toContain('30');
    });
  });

  describe('complex content', () => {
    it('renders mixed content correctly', () => {
      const text = `# Title

This is a paragraph with **bold** and *italic*.

## Code Section

\`\`\`javascript
const x = 1;
\`\`\`

- List item 1
- List item 2

> A quote

---

The end.`;
      const { lastFrame } = render(<MarkdownDisplay text={text} width={80} />);
      const frame = lastFrame()!;
      expect(frame).toContain('Title');
      expect(frame).toContain('bold');
      expect(frame).toContain('const x = 1');
      expect(frame).toContain('•');
      expect(frame).toContain('│');
      expect(frame).toContain('─');
      expect(frame).toContain('The end');
    });
  });

  describe('edge cases', () => {
    it('handles empty text', () => {
      const { lastFrame } = render(<MarkdownDisplay text="" width={80} />);
      expect(lastFrame()).toBeDefined();
    });

    it('handles text with only whitespace', () => {
      const { lastFrame } = render(<MarkdownDisplay text="   \n   \n   " width={80} />);
      expect(lastFrame()).toBeDefined();
    });

    it('handles text without markdown', () => {
      const { lastFrame } = render(<MarkdownDisplay text="Plain text without formatting" width={80} />);
      expect(lastFrame()).toContain('Plain text without formatting');
    });

    it('handles unicode characters', () => {
      const { lastFrame } = render(<MarkdownDisplay text="Hello 世界 🌍" width={80} />);
      expect(lastFrame()).toContain('Hello');
    });

    it('respects width parameter', () => {
      const longText = 'A'.repeat(100);
      const { lastFrame } = render(<MarkdownDisplay text={longText} width={40} />);
      expect(lastFrame()).toBeDefined();
    });
  });
});
