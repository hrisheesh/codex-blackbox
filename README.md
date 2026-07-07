# Codex Blackbox ⬛

**Codex Blackbox** is a local, privacy-first observability and analytics dashboard designed specifically for AI coding sessions.

When an AI coding agent works on your codebase, it writes code, deletes code, triggers tools, and manages context in ways that are often opaque to the developer. Codex Blackbox sits beside your workspace, recording exactly what the agent is doing in real-time, providing deep analytics into its efficiency, and helping you optimize your prompting and agent configuration.

## Why isn't `git diff` enough?
A final `git diff` only tells you the *result* of a coding session. It doesn't tell you the *process*.
If an agent changed 5 lines of code, the diff looks clean. But what if the agent rewrote those 5 lines twenty times, searched the entire project repeatedly, lost context due to memory constraints, and wasted thousands of output tokens in the process?

Codex Blackbox tracks the **operational reality** of the session:
- Write Amplification (How much was written vs. the final size of the code?)
- Compaction Thrashing (Is the agent losing context and repeatedly querying the same files?)
- Suspicious Patterns (Is the agent stuck in a loop trying to fix a test?)

## Key Features

- **Live Dashboard**: Real-time event stream and live metrics updating via WebSockets.
- **Deep File Churn Analytics**: Tracks every write, delete, modification, and recreation, highlighting the most churned files and your Write Amplification ratio.
- **Agent Behavior Heuristics**: Best-effort parsing of Codex logs to detect tool usage (like `grep` or `test`), compaction markers, and contextual thrashing.
- **Rule-Based Recommendations**: Automatically analyzes session behavior (like high write amplification or loop detection) and recommends concrete changes to your agent rules or prompts.
- **Session Comparison**: Select two sessions and visualize their differences side-by-side to track whether your prompt tweaks improved agent efficiency and code quality.
- **LLM Audit Bundle Export**: One-click export of a fully redacted Zip bundle containing session logs, metrics, quality scores, and a copyable prompt for you to pass to an LLM to debug your agent's behavior.

## Local-First & Privacy Statement
Codex Blackbox is strictly local.
- **No Cloud Uploads**: Session data, metrics, logs, and reports never leave your machine.
- **Secret Redaction**: When you export an Audit Bundle, it automatically applies regex-based masking to remove common API keys, passwords, and `.env` values. 

*(Note: Data is saved locally in SQLite and JSON files. Ensure your repository's `.gitignore` avoids pushing `sessions/` and `codex_blackbox.db` to remote repositories if used within a tracked folder).*

## Setup Instructions

### Prerequisites
- Python 3.9+
- Node.js 18+ (npm)

### Backend Setup
1. Navigate to the `backend` directory.
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the FastAPI server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

### Frontend Setup
1. Navigate to the `frontend` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Next.js development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## How to Use

### Starting a Recording
1. Go to the dashboard home page.
2. Enter the absolute path to your active **Project Directory**.
3. (Optional) Provide the absolute path to the agent's **Codex Log Directory** (e.g., `~/.codex`).
4. Give the session a name, add an initial prompt note, and click **Start Recording**.
5. Start your AI agent in your project. Blackbox will instantly begin streaming file system events to the dashboard!

### Prompt Notes
You can add qualitative "Prompt Notes" at any time during a live session using the input box in the right-hand timeline. This is great for logging when you issued a specific instruction to the agent so you can correlate it with the resulting file churn.

### Stopping and Generating a Report
1. Click the red **Stop Recording** button on the dashboard.
2. A review modal will appear asking you to rate the session quality (1-10) and answer a few questions about the agent's performance.
3. Submit the review to instantly generate the full session report.
4. From here, you can view the final metrics or click **Export LLM Audit Bundle** to download the session data.

## Where is data stored?
All data is stored directly in the root directory where you run the backend:
- `codex_blackbox.db`: The SQLite database containing all session metadata, File Events, Churn records, and Reviews.
- `sessions/`: Contains a folder for each `session_id`. Each folder holds raw copied logs, generated markdown (`report.md`) and HTML (`report.html`) reports, and the `llm_audit_bundle.json`.

**Ignored Folders**: The tool automatically ignores standard `node_modules/`, `.git/`, `.next/`, `venv/`, and `.idea/` directories to prevent noise from IDEs and package managers.

## Limitations
- **Token Tracking**: Codex Blackbox does *not* claim to track exact token billing. We track visible file changes and estimate churn, but hidden context tokens consumed by the model provider cannot be tracked by local filesystem observation.
- **Log Parsing**: Codex log parsing is "best-effort". Different agents log tools and compactions differently. Blackbox attempts to identify common markers (like `rg`, `xcodebuild`, `compact`), but it will not crash if logs are unstructured or missing.

## Troubleshooting
- **No events showing up?**: Ensure the absolute project path is correct and that you have permission to read it. Verify you aren't running your agent in an ignored folder like `node_modules`.
- **Logs not parsing?**: Ensure the Codex log path is correct. If the agent changes its logging format, Blackbox will skip unrecognized lines safely.
- **Port already in use?**: If `8000` or `3000` is in use, modify the dev commands (e.g., `uvicorn app.main:app --port 8001`) and update the `API_BASE` in `frontend/lib/api.ts`.
