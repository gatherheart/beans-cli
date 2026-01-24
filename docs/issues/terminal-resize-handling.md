# Terminal Resize Handling in Ink Applications

## Problem

When resizing the terminal window, the Ink-based CLI UI experienced several issues:
1. **Duplicate content** - Messages appeared multiple times after resize
2. **Screen disappearing** - After clearing terminal, content didn't redraw properly
3. **Position errors** - UI elements appeared in wrong positions after resize

## Failed Approaches

### 1. Using `<Static>` Component with Key Remount
```typescript
// Attempted: Force remount by changing key on resize
<Static items={messages} key={remountKey}>
  {message => <Message key={message.id} message={message} />}
</Static>
```
**Result**: Caused duplicate messages to appear.

### 2. ANSI Escape Sequences for Terminal Clear
```typescript
// Attempted: Clear terminal with ANSI codes
stdout.write('\x1b[2J\x1b[3J\x1b[H');
setViewKey(prev => prev + 1);
```
**Result**: Terminal cleared but content didn't redraw properly, position became wrong.

### 3. Using `console.clear()`
```typescript
// Attempted: Use console.clear
console.clear();
setViewKey(prev => prev + 1);
```
**Result**: Similar issues - content didn't properly redraw.

### 4. Using `ansiEscapes.clearTerminal`
```typescript
// Attempted: Using ansi-escapes package (gemini-cli pattern)
import ansiEscapes from 'ansi-escapes';
stdout.write(ansiEscapes.clearTerminal);
setViewKey(prev => prev + 1);
```
**Result**: Duplication fixed but content still disappeared after resize.

## Solution: Claude-Code Pattern

The correct approach is to **NOT clear the terminal at all**. Instead:

1. **Track dimensions in state** - Parent component tracks terminal width/height
2. **Pass dimensions as props** - Children receive width/height props
3. **Let Ink/Yoga handle layout** - The layout engine automatically recalculates

### Implementation

**App.tsx (Parent)**:
```typescript
function AppContent(): React.ReactElement {
  const { columns, rows } = useTerminalSize();

  return (
    <Box flexDirection="column" width={columns} height={rows}>
      <ChatView width={columns} />
      <InputArea width={columns} />
    </Box>
  );
}
```

**useTerminalSize Hook**:
```typescript
export function useTerminalSize(): { columns: number; rows: number } {
  const [size, setSize] = useState({
    columns: process.stdout.columns || 80,
    rows: process.stdout.rows || 24,
  });

  useEffect(() => {
    function updateSize() {
      setSize({
        columns: process.stdout.columns || 80,
        rows: process.stdout.rows || 24,
      });
    }

    process.stdout.on('resize', updateSize);
    return () => {
      process.stdout.off('resize', updateSize);
    };
  }, []);

  return size;
}
```

### Why This Works

1. **No terminal manipulation** - Avoids issues with Ink's internal state
2. **React handles updates** - Dimension changes trigger re-renders
3. **Yoga recalculates layout** - Ink's layout engine handles width changes
4. **Ink diffs output** - Only changed terminal cells are updated

### Reference

Pattern derived from: `/Users/bean/kakao/kash/claude-code/reverse-engineered/src/components/`

## Key Takeaway

Don't fight the framework. Let Ink/Yoga handle terminal resize by passing dimensions as props rather than trying to manually clear and redraw the terminal.
