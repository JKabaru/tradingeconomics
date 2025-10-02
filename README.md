# Nakly: LLM Economic Forecasting Backtester

A browser-based platform for backtesting and benchmarking Large Language Models (LLMs) as economic forecasters, powered by the Trading Economics API.

### Required Keys

You will need to acquire API keys from the following services:

* **Trading Economics**
    * *Needed for historical economic data.*
    * [Get your free key here](https://tradingeconomics.com/analytics/api.aspx)

* **OpenRouter OR Google AI**
    * *Needed for the LLM forecasters and judge.*
    * [Get your free OpenRouter key here](https://openrouter.ai/keys)
    * [Get your free Google AI key here](https://aistudio.google.com/app/apikey)


---

## 🚀 Live Demo

**You can access the application here:**

**[https://tradingeconomics-f55m.onrender.com/](https://tradingeconomics-f55m.onrender.com/)**

---

## 📸 Screenshots

| Results Dashboard | Configuration Wizard |
| :---: | :---: |
| <div><img src="https://github.com/user-attachments/assets/5a5ecdaa-b43a-4923-89ae-ae29fc22a953" alt="Nakly Results Dashboard" width="100%"></div> | <div><img src="https://github.com/user-attachments/assets/0bc56641-93e0-4a86-bf6a-48756db13b6c" alt="Nakly Setup" width="100%"></div> |
| *The backtest results page showing model performance and comparison metrics.* | *The guided 7-step setup for configuring a new backtest.* |

---

## ✨ Core Features

* **Guided Backtest Setup:** A 7-step wizard to configure complex forecasting scenarios involving multiple countries, indicators, and LLMs.
* **Multi-Provider Integration:** Connects seamlessly with data sources (Trading Economics) and LLM providers (OpenRouter, Google Gemini).
* **Tick-by-Tick Simulation:** Executes a historical simulation where "forecaster" LLMs predict economic data points and receive feedback from a designated "judge" LLM.
* **Comprehensive Analytics Dashboard:**
    * **Leaderboard:** Ranks models on a composite score, RMSE, and directional accuracy.
    * **Model Comparison:** Side-by-side performance metrics and prediction charts.
    * **Tick Analytics:** A granular inspector to review every prediction, rationale, and evaluation step.
* **Client-Side Persistence:** The entire application is self-contained in the browser. API keys, configurations, and past run history are securely stored in `localStorage` for session continuity.

---

## 🛠️ Technology Stack
* **Prototyping:** [Google Ai Studio](https://aistudio.google.com/)
* **Frontend:** [React](https.reactjs.org/) & [TypeScript](https://www.typescriptlang.org/)
* **Styling:** [Tailwind CSS](https://tailwindcss.com/)
* **Build Tool:** [Vite](https://vitejs.dev/)
* **State Management:** React Hooks (`useState`, `useEffect`, `useCallback`)

---

## ⚙️ Getting Started

To run this project locally, follow these steps.

### Prerequisites

* [Node.js](https://nodejs.org/) (v18 or later recommended)
* [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

### Installation & Setup

1.  **Clone the repository:**
    ```sh
    git clone [Your GitHub Fork URL]
    cd tradingeconomics-fork-directory
    ```

2.  **Install dependencies:**
    ```sh
    npm install
    ```
    *(or `yarn install`)*

3.  **Run the development server:**
    ```sh
    npm run dev
    ```
    *(or `yarn dev`)*

4.  Open your browser and navigate to `http://localhost:5173` (or the address provided in your terminal).

### Configuration

This application is designed to be fully client-side. **There are no `.env` files to manage.**

Upon launching the application, you will be guided through the setup process where you can enter your API keys directly into the UI:

1.  **Step 1: Data Sources:** Enter your Trading Economics API Key.
2.  **Step 2: LLMs:** Enter your API keys for LLM providers (e.g., OpenRouter, Google AI Studio for Gemini).

These keys are stored securely in your browser's `localStorage` and are never exposed to any server.

---

## 📁 Project Architecture

The codebase is organized with a clear separation of concerns:

-   `src/components/`: Reusable React components (e.g., `Sidebar`, `StatCard`).
-   `src/pages/`: Top-level components for each view (`Wizard`, `ResultsDashboard`).
-   `src/services/`: Contains all business logic and API interactions, cleanly separated from the UI.
    -   `backtestService.ts`: The core simulation engine.
    -   `tradingEconomicsService.ts`: The client for the Trading Economics API.
    -   `llmService.ts`: Abstraction layer for interacting with LLM providers.
-   `src/types.ts`: Centralized TypeScript type definitions for all major data structures.
-   `src/constants.ts`: Stores static data like default prompts and lists.
