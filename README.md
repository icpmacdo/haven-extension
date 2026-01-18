# SPARK

**S**pec **P**owered **A**gent-**R**eady **K**it

A project bootstrapping template for AI-assisted development with Claude.

## What This Is

SPARK is a structured approach to starting new software projects with AI assistance. Instead of diving straight into code, you build up a specification through conversation—then implement against that spec.

The core idea: **discuss before writing, update as you build**.

## Who It's For

- Developers using Claude (or similar AI assistants) to build software
- Projects that benefit from upfront planning and clear specifications
- Anyone tired of AI assistants losing context or making inconsistent decisions

## How It Works

1. **Start a conversation** - Describe what you're building
2. **Fill out specs iteratively** - Use templates to capture decisions as you discuss
3. **Build against the specs** - Implementation follows the documented plan
4. **Keep docs in sync** - Update specs as reality diverges from the plan

The `CLAUDE.md` file gives the AI assistant context about your project. The specs in `docs/spec/` capture your decisions so they persist across sessions.

## Quick Start

```bash
# Clone this repo (or use it as a template)
git clone <this-repo> my-project
cd my-project

# Start by copying the CLAUDE.md template
cp CLAUDE.md.template CLAUDE.md

# Copy spec templates as needed
cp docs/spec/index.md.template docs/spec/index.md
cp docs/spec/stack.md.template docs/spec/stack.md
cp docs/spec/build-order.md.template docs/spec/build-order.md

# Copy these if applicable to your project
cp docs/spec/backend.md.template docs/spec/backend.md
cp docs/spec/ui.md.template docs/spec/ui.md

# Copy the feature template for each major feature
cp docs/spec/feature.md.template docs/spec/my-feature.md
```

Then open a conversation with Claude and say what you're building. The `CLAUDE.md` file will guide the process.

## What's Included

```
├── CLAUDE.md.template          # AI assistant project guide
├── docs/
│   ├── spec-strategy.md        # The methodology (read this to understand the approach)
│   └── spec/
│       ├── index.md.template       # Spec overview and entry point
│       ├── stack.md.template       # Tech stack decisions
│       ├── build-order.md.template # Implementation order
│       ├── backend.md.template     # Backend architecture
│       ├── ui.md.template          # UI patterns and design system
│       └── feature.md.template     # Template for individual features
```

## The Methodology

Read `docs/spec-strategy.md` for the full approach. Key principles:

- **Discuss before writing** - Specs emerge from conversation, not isolation
- **Living documents** - Update specs as you build and learn
- **Separate concerns** - Stack, backend, UI, and features in separate docs
- **Cross-reference** - Feature specs link to relevant shared specs
- **Build order** - Know what to build first and why

## Template Placeholders

All templates use `{{PLACEHOLDER}}` syntax. Replace these with your project-specific content as you fill out each spec.

## Tips

- **Don't fill everything upfront** - Start with what you know, mark the rest as `🔲 Pending`
- **Start broad, narrow gradually** - High-level decisions first, details later
- **Keep the index updated** - It's your map to everything else
- **Update specs during implementation** - A stale spec is worse than no spec
