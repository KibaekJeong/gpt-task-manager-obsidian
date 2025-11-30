# GPT Task Manager for Obsidian

An AI-powered task manager plugin for Obsidian that integrates with your existing vault structure, templates, and goals. Uses GPT-4 for intelligent task creation, breakdown, and prioritization, plus voice input via Whisper.

## ✨ Features

### 🚀 Quick Task Creation (GPT Assisted)
- Describe tasks naturally in your own words
- GPT analyzes your goals, projects, and epics to suggest:
  - Clear, actionable task titles
  - Specific objectives and importance
  - Appropriate Epic/Project associations
  - Priority recommendations
  - Complexity assessment

### 🎤 Voice Task Input
- Create tasks by speaking using Whisper transcription
- Supports Korean and English (auto-detection available)
- Extracts priority and project references from natural speech

### 📊 Epic Breakdown
- Select any Epic in your vault
- GPT generates 3-8 actionable subtasks
- Maintains task dependencies
- Inherits Epic's Area, Goal, and Project

### 🎯 Context-Aware Suggestions
- Loads your existing:
  - Goals (from `300 Goals & Milestone/Goals`)
  - Projects (from `400 Projects`)
  - Epics (from `500 Plan & Reflect/510 Epics`)
  - Active Tasks
- Provides intelligent suggestions based on your current focus

### 📝 Template Integration
- Uses your existing `4 Task Template.md`
- Maintains your frontmatter structure:
  - Type, Area, Goal, Project, Epic
  - Status, Priority, Due
  - Created, Updated timestamps
  - Parent task linking

## 🛠️ Installation

### Manual Installation
1. Download the latest release
2. Extract to your vault's `.obsidian/plugins/gpt-task-manager` folder
3. Enable the plugin in Obsidian settings

### From Source
```bash
cd /path/to/your/vault/.obsidian/plugins
git clone https://github.com/your-repo/gpt-task-manager-obsidian
cd gpt-task-manager-obsidian
npm install
npm run build
```

## ⚙️ Configuration

### Required Setup
1. Open Obsidian Settings → GPT Task Manager
2. Enter your OpenAI API Key
3. Configure your vault paths if they differ from defaults

### Default Paths (based on your SecondBrain structure)
- Tasks: `500 Plan & Reflect/520 Tasks`
- Epics: `500 Plan & Reflect/510 Epics`
- Goals: `300 Goals & Milestone/Goals`
- Projects: `400 Projects`
- Templates: `900 Templates`

### Features Toggle
- **Voice Input**: Enable/disable microphone recording
- **Smart Suggestions**: Enable/disable GPT task enhancement
- **Auto Breakdown**: Enable/disable complexity detection

## 📖 Usage

### Quick Task Creation
1. Click the ➕ ribbon icon or use command `Quick Task Creation (GPT Assisted)`
2. Describe your task naturally:
   - "Build a landing page for the Travel App"
   - "High priority: Fix the payment integration bug"
   - "Research competitor apps for Freedom Runway"
3. Review and edit the GPT suggestion
4. Select an Epic (optional)
5. Create the task

### Voice Task
1. Click the 🎤 ribbon icon or use command `Voice Task Creation`
2. Click "Start Recording"
3. Speak your task naturally
4. Click "Stop & Process"
5. Review the transcribed task

### Epic Breakdown
1. Use command `Break Down Epic into Tasks`
2. Select an Epic from the fuzzy finder
3. GPT generates subtasks with:
   - Clear titles and objectives
   - Priority levels
   - Task dependencies
4. Review and confirm
5. Tasks are created in the Epic's folder

### Create from Selection
1. Select text in any note
2. Use command `Create Task from Selection (GPT)`
3. The selection becomes the task input

## 🔧 Customization

### Custom GPT Prompts
You can customize the prompts used for:
- Task Creation
- Epic Breakdown
- Prioritization

Available placeholders:
- `{{goals}}` - List of your goals
- `{{projects}}` - List of your projects
- `{{epics}}` - List of your epics
- `{{input}}` - User's task description
- `{{title}}`, `{{description}}`, `{{objective}}` - For breakdown

### Task Defaults
- Default Status: `backlog`
- Default Priority: `medium`
- Default Language: Korean (configurable)

## 🗂️ Task Structure

Created tasks follow your existing template structure:

```markdown
---
Type: "[[Tasks]]"
Area: "[[Freedom & Purpose]]"
Goal: "[[Financial Independence Empire]]"
Project: "[[Solopreneur Financial Model]]"
Epic: "[[Freedom Runway Plan]]"
Status: backlog
Priority: high
Due: 
Created: "2025-11-30 10:30"
Updated: "2025-11-30 10:30"
tags:
  - tasks
---

## 🔄 Sync
- [ ] Task title

## 🎯 Objective
> What needs to be accomplished:
- Clear objective from GPT

> Why it matters:
- Importance explanation

## ⚙️ Progress Log
...
```

## 🎨 Commands

| Command | Description |
|---------|-------------|
| `Quick Task Creation (GPT Assisted)` | Create task with AI enhancement |
| `Voice Task Creation` | Record voice to create task |
| `Break Down Epic into Tasks` | Split epic into subtasks |
| `Simple Task Creation (No AI)` | Create task without GPT |
| `Create Task from Selection (GPT)` | Use selected text as task input |

## 🔐 Privacy

- Your OpenAI API key is stored locally in the plugin data
- Task content is sent to OpenAI for processing
- No data is stored on external servers beyond OpenAI's API
- Voice recordings are processed via Whisper and not stored

## 📝 License

MIT License - See LICENSE file for details

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## 🐛 Issues

Report bugs or request features via GitHub Issues.

---

Built with ❤️ for the Obsidian community

