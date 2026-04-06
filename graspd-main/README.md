ChatPanel.jsx
    Main chat system (core logic)
    Takes user input and sends to AI
    Receives AI response and updates UI
    Sends canvas shapes + history to backend
    Handles file upload (image/pdf)
MessageBubble.jsx
    Displays each chat message
    Handles user vs AI message UI
    Renders AI response (text + resources)
    Uses structured response (type, message, resources)
    No API logic
ResourceCard.jsx
    Displays resource links (YouTube/article)
    Shows title + clickable link
    Button to send resource to canvas
    Uses resource {kind, title, url}
    Pure UI
services/gemini.js
    Handles AI calls (main API layer)
    Sends message + history + canvas context
    Builds prompt for AI
    Returns structured JSON response
    Will be replaced by FastAPI
storage.js
    Stores chat history in browser
    Uses localStorage
    Save, get, delete chat per page
    Not shared across users
    Temporary (replace with backend later)
HistoryItem.jsx
    Shows one chat session in sidebar
    Displays topic + time
    Handles click (switch session)
    Handles delete session
    Uses session {id, topic, createdAt}
HistoryPanel.jsx
    Stores and displays session history by fetching sessions using getHistory() and grouping them (Today, Yesterday, etc.)

    Creates a new canvas/session using editor.createPage() and saves it with saveSession()

    Handles switching between sessions by loading the correct canvas when a user selects a history item

    Deletes sessions by removing them from both the UI history and the canvas editor

    Controls UI behavior like collapsing/expanding the sidebar and showing an empty state when no history exists
Canvas.jsx
    Manages the main canvas layout by combining the drawing area, history panel, and chat panel

    Initializes the tldraw editor and stores it in state when the canvas mounts

    Controls chat panel visibility (open/close) using state

    Tracks the currently active session and updates it when a session changes

    Handles layout adjustments when the history panel is collapsed or expanded    

CanvasPrompt.jsx
    Takes a topic input from the user and triggers knowledge graph generation

    Calls generateKnowledgeGraph() to get AI-generated data and processes it using layout and paint functions

    Renders the generated graph onto the canvas using the tldraw editor

    Creates and saves a new session linked to the current canvas page

    Provides a button to open the chat (tutor) panel for further interaction    

cta.jsx
    Displays a call-to-action section encouraging users to join a waitlist

    Renders a heading, description, and an email input field

    Provides a button for users to submit their email

    Handles only UI layout and styling (no logic or API calls)

    Acts as a static promotional component for user onboarding
FeatureSelection.jsx
    Renders a reusable feature section with title, description, and bullet points

    Displays dynamic content using props like text, colors, and icons

    Maps over a list of bullet items to show feature highlights

    Supports layout switching (left/right) using the flip prop

    Allows embedding custom demo content (like images, videos, or components)    
Hero.jsx
    Displays the main landing section with heading, description, and call-to-action buttons

    Navigates the user to the canvas page when “try it free” is clicked

    Shows a visual demo using the HeroMockup component

    Structures the layout into left (text) and right (visual) sections

    Acts as the entry point for users to start using the app
HeroMockup.jsx
    Displays a static visual mockup of the canvas interface on the landing page

    Shows UI elements like shapes, nodes, connectors, and labels to simulate a knowledge graph

    Includes fake collaborative features like cursors, comments, and presence indicators

    Represents how the actual app will look and behave without using real data or logic

    Acts purely as a visual/demo component to attract users      
Nav.jsx
    Displays the top navigation bar with logo and menu links

    Provides navigation links to different sections on the landing page

    Uses a button to navigate to the canvas page using React Router

    Shows login and quick-start action buttons

    Serves as the main navigation header across the app
useIntersectionOberserver.js
    Creates a custom React hook to trigger animations when elements come into view

    Uses IntersectionObserver to detect when elements appear on the screen

    Adds a CSS class (on) to elements when they become visible

    Observes all child elements with classes like .reveal, .reveal-l, .reveal-r

    Returns a ref that is attached to a parent container to enable this behavior      
CanvasPage.jsx
    Acts as a page-level component for the canvas route

    Renders the main Canvas component

    Serves as a wrapper between routing and the actual canvas UI

    Used by React Router to display the canvas page when user navigates to /canvas

    Keeps routing structure clean by separating pages from components    
LandingPage.jsx
    Renders the complete landing page by combining components like Nav, Hero, Feature sections, CTA, and Footer

    Defines and passes feature data (bullets, icons, descriptions) to reusable FeatureSection components

    Uses useEffect with IntersectionObserver to trigger scroll-based animations

    Organizes the page into multiple sections like AI canvas, collaboration, and live tutor

    Acts as the main entry screen before users navigate to the canvas    
graphLayout.js
    Takes raw graph data (nodes and edges) and calculates positions for each node on the canvas

    Places the main (core) node at the center and arranges sub-nodes in a circular layout around it

    Positions detail nodes around each sub-node in a spread-out pattern to avoid overlap

    Handles edge cases by assigning positions to any unplaced nodes

    Returns the final positioned graph data to be rendered on the canvas
paintGraph.js
    Takes positioned graph data and renders it onto the tldraw canvas using the editor

    Draws connections (edges) between nodes using arrow shapes

    Creates visual node shapes (rectangles) with styles based on their type (core, sub, detail)

    Adjusts node size dynamically based on label length

    Automatically zooms the canvas to fit the entire graph after rendering        
App.jsx
    Sets up routing for the entire React application using react-router-dom

    Defines different pages (routes) like the landing page (/) and canvas page (/canvas)

    Loads the LandingPage when user visits /

    Loads the CanvasPage when user navigates to /canvas

    Acts as the main entry point that controls which page is shown    
main.jsx
    Acts as the entry point of the React application where everything starts

    Renders the main App component into the HTML root element

    Initializes React’s rendering system using ReactDOM.createRoot()

    Wraps the app in React.StrictMode for better debugging and error detection

    Loads global styles like tldraw.css and index.css
    