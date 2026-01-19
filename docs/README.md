# Documentation

## Structure

```
docs/
├── README.md           # This file
├── sop/                # Standard Operating Procedures
│   ├── README.md       # SOP index
│   ├── development.md  # Development setup & commands
│   ├── testing.md      # Testing guidelines
│   └── coding.md       # Coding standards (TS, React)
├── prd/                # Product Requirements Documents
│   ├── README.md       # PRD task list & status
│   └── *.md            # Feature specifications
├── guides/             # Implementation Guides
│   ├── README.md       # Guide index
│   └── *.md            # How things work
├── issues/             # Issues & Solutions
│   ├── README.md       # Issue index
│   └── *.md            # Problem → Solution docs
└── architecture/       # System Architecture
    ├── README.md       # Architecture index
    └── overview.md     # System overview
```

## Folder Purposes

| Folder | Purpose | When to Add |
|--------|---------|-------------|
| `sop/` | Development guidelines, coding standards | Process or guideline changes |
| `prd/` | Feature specifications, requirements | New features planned |
| `guides/` | How implementations work | After completing a feature |
| `issues/` | Problems and their solutions | After solving tricky issues |
| `architecture/` | System design, component interactions | Architectural changes |

## Quick Links

- [Development Setup](sop/development.md)
- [PRD Status](prd/README.md)
- [Architecture Overview](architecture/overview.md)
