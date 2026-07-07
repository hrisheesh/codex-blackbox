# Codex Blackbox System Design

This document outlines the architecture, data flow, component structure, and design principles of the Codex Blackbox application.

## 1. High-Level Architecture
Codex Blackbox is built on a decoupled, strictly local Client-Server architecture designed to observe AI agents running on the host machine without interfering with their operation.

### Backend (`/backend`)
- **Framework:** FastAPI (Python 3.9+)
- **Database:** SQLite (`codex_blackbox.db`) via SQLAlchemy ORM.
- **Role:** Acts as the observation engine. It runs background threads to watch the filesystem (using `watchdog`) and parse Codex logs. It serves REST API endpoints for CRUD operations on sessions and provides real-time updates to the frontend via WebSockets.
- **Concurrency:** Uses asynchronous Python (`asyncio`) for non-blocking HTTP requests and WebSockets, while offloading blocking file I/O to background threads.

### Frontend (`/frontend`)
- **Framework:** Next.js 14+ (App Router, React 18)
- **Styling:** Tailwind CSS (v4), Framer Motion, shadcn/ui.
- **Role:** Provides the interactive, real-time observability dashboard. Connects to the backend via REST for initial data fetches and WebSockets for real-time telemetry.

## 2. Core Data Flow & Event Processing

The core value of Blackbox is transforming raw filesystem noise into structured agent behavioral metrics.

### Phase 1: Observation
When a session is started, the backend spawns a `SessionManager` which initializes:
1. **File System Watcher (`watchdog`)**: Recursively watches the specified project directory for `created`, `modified`, and `deleted` events. It applies strict ignore rules (e.g., `.git`, `node_modules`) to filter noise.
2. **Log Watcher (Best-Effort)**: Tails the configured Codex log directory (`~/.codex` by default) looking for new lines that indicate tool usage (`grep`, `xcodebuild`) or context compactions.

### Phase 2: Ingestion & Telemetry
- Events are pushed into an asynchronous queue.
- The `SessionManager` processes the queue, persists raw events to the `FileEvent` table in SQLite, and updates aggregated state in the `FileChurn` table (tracking lines written, deleted, and write amplification).
- The updated state is immediately broadcasted over a WebSocket connection to the frontend.

### Phase 3: Analytics & Export
- **Recommendations Engine**: Evaluates the session's `FileChurn` and event history against predefined rules (e.g., detecting repeated searches, high write amplification, or compaction thrashing) to generate actionable feedback.
- **Report Generation**: Uses Jinja2 templates to compile Markdown and HTML reports.
- **Export Bundle**: Zips the reports, raw JSON lines, and metadata, applying regex-based secret redaction (API keys, `.env` values) before the file is downloaded by the user.

## 3. Database Schema

The SQLite database (`codex_blackbox.db`) tracks the following core entities:

- **`Session`**: The root entity. Tracks project path, timestamps, status (`recording`, `stopped`), and the final qualitative review (`quality_score`, `notes`).
- **`FileEvent`**: An immutable log of every action observed during a session (e.g., `file_modified`, `codex_log_marker`). Forms the basis of the live timeline.
- **`FileChurn`**: An aggregated view per file per session. Tracks `rewrite_count`, `total_lines_written`, `total_lines_deleted`, and current file size to calculate the `Write Amplification` metric.
- **`PromptNote`**: User-submitted qualitative markers inserted into the timeline during recording.

## 4. Frontend Component Architecture

The frontend was overhauled to move away from a monolithic page structure into modular, reusable components with a focus on premium aesthetics.

### Directory Structure
```text
frontend/
├── app/
│   ├── layout.tsx         # Global layout and context providers
│   ├── page.tsx           # Home: Start form and session list
│   ├── dashboard/page.tsx # Live Session Dashboard
│   └── compare/page.tsx   # Side-by-side Session Comparison
├── components/
│   ├── layout/
│   │   └── Header.tsx     # Glassmorphic top navigation
│   └── dashboard/
│       ├── MetricWidget.tsx    # Animated KPI cards
│       ├── TimelinePanel.tsx   # Live scrolling event stream
│       ├── AnalysisSection.tsx # Patterns & Recommendations display
│       └── ReviewModal.tsx     # End-of-session qualitative input
```

### Design Principles (UI/UX)
- **Premium Dark Mode**: The application defaults to a sleek dark theme using specific `oklch` color spaces (Slate/Blue/Emerald accents) and radial gradient background patterns.
- **Glassmorphism**: Heavy use of translucent backgrounds (`bg-white/5`, `bg-black/20`) with backdrop blurring (`backdrop-blur-md`) to create depth and a modern OS-like feel.
- **Micro-animations**: Powered by Framer Motion. Elements fade and slide in smoothly on mount. The live timeline features pulsating dot indicators for new events.
- **Information Hierarchy**: Complex data is broken down into easily scannable components. High-severity suspicious patterns are highlighted in Rose/Amber, while standard metrics use neutral tones.
- **Resilience**: The frontend explicitly catches `404 Not Found` API errors and renders graceful fallback UI states rather than crashing.

## 5. Privacy & Security Model

- **Strictly Local**: The application operates entirely on `localhost`. There is no telemetry, analytics, or cloud synchronization.
- **Data Isolation**: All session data is stored in the local SQLite database and the local `sessions/` directory.
- **Redaction**: The export pipeline (`llm_audit_bundle.json`) sanitizes outputs before they are shared with external LLMs, masking potential secrets (Passwords, API keys, Certificates) to prevent accidental credential leakage.
