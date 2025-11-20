
# Personalized Learning Mentor: The Adaptive AI Tutor 🎓

> **A multi-agent AI system that builds bespoke 30-day curricula, adapts to your learning style, and ensures mastery through real-time multimodal coaching.**

<p align="center">
  <img src="thumbnail.svg" alt="Project Banner" />
</p>
---

### 🚨 The Problem
Self-directed learning is broken.
*   **Paralysis:** "There are 10,000 videos on React. Which one do I watch first?"
*   **Isolation:** "I'm stuck on a bug, and ChatGPT forgot context from yesterday."
*   **Static Content:** "I already know variables, why is this course forcing me to watch a 20-minute video on them?"

### 💡 The Solution
The **Personalized Learning Mentor (PLM)** is a sophisticated **Multi-Agent System** that acts as your private, adaptive tutor. It doesn't just answer questions; it assesses you, builds a plan, teaches you daily, and verifies your knowledge.

*   **It Remembers:** Maintains long-term memory of your goals, skill level, and learning style.
*   **It Plans:** Uses "Thinking Mode" to reason through complex dependency trees to build a 30-day schedule.
*   **It Sees & Hears:** Uses Multimodal capabilities (Vision & Voice) to interact naturally.

---

## 2. How It Works (Agent Workflow)

The application orchestrates **5 Specialized Agents** to guide the user from "Zero to Mastery".

```mermaid
graph TD
    User([User]) -->|Goal: 'Learn React'| Diagnostic[Diagnostic Agent<br/>gemini-2.5-flash]
    
    subgraph Onboarding
        Diagnostic <-->|Adaptive Interview| User
        Diagnostic -->|Output| Profile{Learner Profile<br/>JSON}
    end
    
    Profile --> Planner[Planner Agent<br/>gemini-3-pro-preview]
    Planner -->|Thinking Mode 32k| Plan[30-Day Curriculum<br/>JSON]
    Plan --> DB[(Local Storage)]
    
    subgraph Daily Learning Loop
        DB --> Dashboard[Dashboard UI]
        Dashboard -->|Start Day| Coach[Coaching Agent<br/>gemini-3-pro-preview]
        
        Coach <-->|Chat & Vision| User
        
        subgraph Tools & Modalities
            Coach -.->|Voice Mode| Live[Voice Agent<br/>Gemini Live API]
            Coach -.->|Grounding| Search[Google Search]
            Coach -.->|Visuals| Mermaid[Mermaid Diagram Generator]
        end
        
        User -->|Finish Session| Quiz[Quiz Agent<br/>gemini-2.5-flash]
        Quiz -->|Generate Questions| User
        User -->|Submit Answers| Feedback[Feedback Agent<br/>gemini-2.5-flash]
        Feedback -->|Update Stats| DB
    end
```

---

## 3. The Agents & Technology

This project leverages the specific strengths of the Gemini model family via the `@google/genai` SDK.

### 🧠 1. The Diagnostic Agent ("The Gatekeeper")
*   **Model:** `gemini-2.5-flash`
*   **Role:** Adaptive Interviewer.
*   **Innovation:** Instead of relying on self-assessment (e.g., "I'm intermediate"), it uses **"Gatekeeper Scenarios"**—concrete problems to test actual competence using Bloom's Taxonomy.

### 🗺️ 2. The Planner Agent ("The Architect")
*   **Model:** `gemini-3-pro-preview`
*   **Role:** Curriculum Designer.
*   **Innovation:** Uses **Thinking Config** (budget: 32,768 tokens) to deeply reason through the logical progression of skills required to reach the user's goal, ensuring the 30-day plan is coherent.

### 🎓 3. The Coaching Agent ("The Companion")
*   **Model:** `gemini-3-pro-preview`
*   **Role:** Socratic Tutor.
*   **Innovation:** Fully **Multimodal**.
    *   **Vision:** Can analyze uploaded screenshots of code errors or handwritten notes.
    *   **Visuals:** Generates code blocks that render into dynamic **Mermaid.js** flowcharts.
    *   **Grounding:** Connects to **Google Search** for up-to-date documentation.

### 🎙️ 4. The Voice Agent ("The Conversationalist")
*   **Model:** `gemini-2.5-flash-native-audio`
*   **Role:** Verbal Tutor.
*   **Innovation:** connects directly to the **Gemini Multimodal Live API** via WebSockets. It handles raw PCM audio encoding/decoding in the browser for low-latency, interruptible voice conversations.

### 📊 5. The Feedback Loop
*   **Models:** `gemini-2.5-flash`
*   **Role:** Assessor.
*   **Innovation:** The **Quiz Agent** generates questions based *strictly* on that day's objective. The **Feedback Agent** analyzes mistakes to identify root misconceptions and provides direct links to remedial resources.

---

## 4. Installation & Setup

### Prerequisites
*   **Node.js 18+** installed.
*   A **Google AI Studio API Key**.

### Local Development
1.  **Clone the repository**
    ```bash
    git clone https://github.com/your-username/personalized-learning-mentor.git
    cd personalized-learning-mentor
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Configure API Key**
    Set your API key in your environment variables (or create a `.env` file):
    ```bash
    export API_KEY="your_actual_api_key_here"
    ```

4.  **Run the App**
    ```bash
    npm run dev
    ```
    Open `http://localhost:5173` (or the port shown in your terminal).

### Docker Deployment (Bonus) 🐳
To build and run the containerized application:

1.  **Build the Image**
    ```bash
    docker build -t learning-mentor .
    ```

2.  **Run the Container**
    Pass your API key as an environment variable:
    ```bash
    docker run -p 8080:80 -e API_KEY="your_key_here" learning-mentor
    ```
    Access at `http://localhost:8080`.

---

## 5. Future Roadmap

*   **Real-time Code Execution:** Integrating Pyodide to run Python code directly in the browser instead of just simulating the output.
*   **RAG Integration:** Adding a Vector Database (e.g., Pinecone) to store long-term conversation history, allowing the agent to reference mistakes made weeks ago.
*   **LMS Integration:** Adding LTI support to plug into Canvas/Blackboard for institutional use.

---
