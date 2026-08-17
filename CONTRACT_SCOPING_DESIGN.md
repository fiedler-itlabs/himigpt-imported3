# Contract Scoping Feature - Design Document

## Problem Statement

Users have hundreds of contracts uploaded. When starting a chat, they want to:
1. **Scope to specific contracts** - Search only in selected contracts (e.g., "only AOK contracts" or "only 2024 contracts")
2. **Free chat** - Search across all contracts
3. **Visual indication** - See which contracts are active in the current chat

## User Stories

### Story 1: Targeted Search
> "Als Mitarbeiter möchte ich einen Chat nur mit AOK-Verträgen starten, damit ich schneller Antworten zu AOK-spezifischen Fragen bekomme."

### Story 2: Comparison Across Subset
> "Als Mitarbeiter möchte ich 5 spezifische Verträge auswählen und diese vergleichen, ohne dass andere Verträge die Suche beeinflussen."

### Story 3: All Contracts
> "Als Mitarbeiter möchte ich einen freien Chat starten, der alle Verträge durchsucht, wenn ich nicht sicher bin, welche Krankenkasse relevant ist."

## UX Design

### Option A: Pre-Chat Contract Selector (Recommended)

**Flow:**
1. User clicks "Neuen Chat starten"
2. **Modal/Drawer opens**: "Chat-Kontext wählen"
   - Option 1: "Alle Verträge durchsuchen" (default)
   - Option 2: "Bestimmte Verträge auswählen"
3. If Option 2 selected → Show contract selector
4. Chat starts with selected scope

**Contract Selector UI (for hundreds of contracts):**
- **Search bar** at top: Filter by name, insurance company, product area
- **Filter chips**: Quick filters (Krankenkasse, Produktbereich, Jahr)
- **Grouped list**: Group by insurance company (collapsible)
- **Multi-select**: Checkboxes for individual contracts
- **Bulk actions**: "Alle AOK auswählen", "Alle 2024 auswählen"
- **Selected counter**: "5 Verträge ausgewählt"

**Example UI:**
```
┌─────────────────────────────────────┐
│  Chat-Kontext wählen                │
├─────────────────────────────────────┤
│  ○ Alle Verträge (245)              │
│  ● Bestimmte Verträge auswählen     │
│                                     │
│  ┌──────────────────────────────┐  │
│  │ 🔍 Verträge suchen...        │  │
│  └──────────────────────────────┘  │
│                                     │
│  Filter: [AOK ×] [2024 ×]          │
│                                     │
│  ▼ AOK Bayern (12 Verträge)        │
│    ☑ Vertrag AOK Bayern - Betten  │
│    ☐ Vertrag AOK Bayern - Rollst. │
│    ...                              │
│                                     │
│  ▼ IKK Classic (8 Verträge)        │
│    ☐ Vertrag IKK Classic - Betten │
│    ...                              │
│                                     │
│  [Alle abwählen]  [5 ausgewählt]   │
│                                     │
│  [Abbrechen]  [Chat starten →]     │
└─────────────────────────────────────┘
```

### Option B: Inline Selector (Alternative)

**Flow:**
1. Chat page has persistent contract selector in sidebar
2. User selects contracts before typing first message
3. Scope applies to entire chat session

**Pros:** Always visible, easy to change mid-chat
**Cons:** Takes up space, less clear when scope is set

### Option C: Command-Based (Not Recommended)

**Flow:**
1. User types `/scope @AOK @IKK` to set scope
2. System confirms: "Chat auf 15 Verträge beschränkt"

**Pros:** Power-user friendly
**Cons:** Not discoverable, hard to use with hundreds of contracts

## Recommended: Option A (Pre-Chat Selector)

**Why:**
- Clear intent: User decides scope before asking questions
- Scalable: Search + filters handle hundreds of contracts
- Visual: Selected contracts shown in chat header
- Flexible: Can start new chat with different scope

## In-Chat Visual Indicators

### Chat Header
Show active scope in chat header:

```
┌────────────────────────────────────────┐
│  Chat: AOK-Verträge Vergleich          │
│  📋 5 Verträge: AOK Bayern (3), AOK... │
│  [Scope ändern]                        │
└────────────────────────────────────────┘
```

### Chat List Sidebar
Show scope icon in chat list:

```
┌─────────────────────────┐
│  📋 AOK-Verträge (5)    │  ← Scoped chat
│  💬 Allgemeine Fragen   │  ← Free chat (all contracts)
│  📋 IKK Vergleich (3)   │  ← Scoped chat
└─────────────────────────┘
```

### Message Context
Show scope reminder in first message:

```
User: Was zahlt die AOK für 19.40.01.7?

System: 🔍 Durchsuche 5 ausgewählte Verträge...
