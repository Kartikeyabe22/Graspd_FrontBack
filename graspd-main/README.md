# graspd

graspd is an AI-powered learning canvas for turning a topic into a structured knowledge graph, then exploring it through an editable infinite canvas. Users can sign up, log in, generate a graph from a prompt, and continue refining the canvas with AI-assisted explanations and resources.

The app is built with React, Vite, and tldraw on the frontend, and it expects a separate backend for authentication and session-aware chat. Gemini powers the graph generation and tutor responses.

## What It Does

- Generates detailed knowledge graphs from a topic prompt.
- Renders the graph directly on an editable tldraw canvas.
- Supports authenticated access to the canvas experience.
- Lets the AI tutor answer questions in the context of the current canvas.
- Surfaces relevant resources and supports file-aware prompts through the chat layer.

## Core Experience

1. Visit the landing page to see the product overview and feature demos.
2. Register or log in to access the protected canvas route.
3. Enter a topic and generate a graph with AI.
4. Move, resize, and extend the generated nodes on the canvas.
5. Ask the tutor follow-up questions or request deeper subgraphs.

## Tech Stack

| Layer | Tech |
| --- | --- |
| Frontend | React 18, Vite, React Router |
| Canvas | tldraw |
| AI | Google Gemini |
| Auth | Token-based login stored in localStorage |
| Styling | CSS modules and global CSS |

## Project Structure

```text
graspd/
├── src/
│   ├── components/      # Canvas, hero, demo, and shared UI components
│   ├── pages/           # Landing, login, register, and canvas routes
│   ├── services/        # Gemini integration and chat helpers
│   ├── utils/           # Auth helpers and shared utilities
│   └── App.jsx          # App routes and protected canvas route
├── public/
├── package.json
└── vite.config.js
```

## Getting Started

### Prerequisites

- Node.js 18 or newer
- npm
- A Gemini API key
- The backend API used by the auth and chat flow

### Install Dependencies

```bash
npm install
```

### Environment Variables

Create a `.env` file in the project root with the variables used by the app:

```bash
VITE_GEMINI_API_KEY=your_gemini_api_key
VITE_API_URL=http://localhost:8000
```

`VITE_GEMINI_API_KEY` is required for graph generation and AI tutor responses. `VITE_API_URL` should point to the backend that exposes the register, login, and session chat endpoints.

### Run the App

```bash
npm run dev
```

### Build for Production

```bash
npm run build
```

### Preview the Production Build

```bash
npm run preview
```

## Backend Expectations

The frontend expects a backend that can handle authentication and chat/session requests. From the current codebase, the important endpoints are:

- `POST /auth/register`
- `POST /auth/token`
- `GET /sessions/:sessionId/documents`
- `POST /sessions/:sessionId/chat`

The login flow stores the returned access token in `localStorage` and uses it to guard access to the canvas route.

## Key Features

- Auth-gated `/canvas` route
- AI-generated knowledge graphs
- Editable infinite canvas with tldraw
- Canvas-aware tutoring
- File-aware chat support
- Landing page demos for the main product features

## Notes

- The canvas is protected, so unauthenticated users are redirected to `/login`.
- Gemini responses are expected to return structured JSON.
- The backend URL is currently hard-coded in the auth pages, so keep it aligned with your local API while developing.
    