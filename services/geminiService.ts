
import { GoogleGenAI, Type } from "@google/genai";
import { DayPlan, Message, QuizQuestion, QuizResult, UserProfile } from "../types";
import { 
  DIAGNOSTIC_SYSTEM_INSTRUCTION, 
  PLANNER_SYSTEM_INSTRUCTION, 
  COACH_SYSTEM_INSTRUCTION,
  QUIZ_GENERATOR_PROMPT,
  FEEDBACK_AGENT_PROMPT
} from "./prompts";

const API_KEY = process.env.API_KEY || '';

let ai: GoogleGenAI | null = null;

const getAI = () => {
  if (!ai) {
    if (!API_KEY) {
      console.error("API Key is missing");
      throw new Error("API Key is missing");
    }
    ai = new GoogleGenAI({ apiKey: API_KEY });
  }
  return ai;
};

/**
 * DIAGNOSTIC AGENT
 */
export const runDiagnosticTurn = async (
  history: Message[],
  userInput: string,
  currentTopic: string,
  image?: string
): Promise<string> => {
  const client = getAI();
  const model = "gemini-2.5-flash";

  // Construct a history string for the prompt context
  const historyText = history
    .map(m => `${m.role === 'user' ? 'Student' : 'Agent'}: ${m.text}`)
    .join('\n');

  const prompt = `
    ${DIAGNOSTIC_SYSTEM_INSTRUCTION}
    
    Current Topic of Interest: ${currentTopic || "Unknown"}
    
    Conversation History:
    ${historyText}
    
    Student: ${userInput}
    Agent:
  `;
  
  let contents: any = prompt;
  
  // Handle multimodal input (Resume/Screenshot)
  if (image) {
      const base64Data = image.split(',')[1];
      const mimeType = image.split(';')[0].split(':')[1];
      contents = {
          parts: [
              { text: prompt },
              { inlineData: { mimeType, data: base64Data } }
          ]
      };
  }

  const response = await client.models.generateContent({
    model,
    contents: contents,
  });

  return response.text || "I'm listening. Could you tell me more?";
};

/**
 * PLANNER AGENT
 * Upgraded to Gemini 3 Pro with Thinking for complex planning
 */
export const generateLearningPlan = async (goal: string, level: string): Promise<DayPlan[]> => {
  const client = getAI();
  const model = "gemini-3-pro-preview";

  const prompt = PLANNER_SYSTEM_INSTRUCTION
    .replace('{{goal}}', goal)
    .replace('{{level}}', level)
    .replace('{{style}}', 'Adaptive');

  try {
    const response = await client.models.generateContent({
      model,
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 32768 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              day: { type: Type.INTEGER },
              title: { type: Type.STRING },
              objective: { type: Type.STRING },
              activities: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING } 
              }
            },
            required: ["day", "title", "objective", "activities"]
          }
        }
      }
    });

    if (response.text) {
        const plans = JSON.parse(response.text);
        // Hydrate status: first day active, others locked
        return plans.map((p: any, index: number) => ({
            ...p,
            status: index === 0 ? 'active' : 'locked'
        }));
    }
    throw new Error("Empty response from planner");
  } catch (e) {
    console.error("Planning failed", e);
    // Fallback
    return Array.from({ length: 30 }, (_, i) => ({
      day: i + 1,
      title: `Day ${i + 1}: Fundamentals`,
      objective: "Core concepts mastery",
      activities: ["Read material", "Practice exercises"],
      status: i === 0 ? 'active' : 'locked'
    }));
  }
};

/**
 * COACH AGENT (Streaming)
 * Upgraded to Gemini 3 Pro for superior conversational capability
 */
export const createCoachSession = (topic: string, dayPlan: DayPlan, history: Message[]) => {
  const client = getAI();
  const model = "gemini-2.5-flash";

  const systemInstruction = COACH_SYSTEM_INSTRUCTION(topic, dayPlan);

  const chat = client.chats.create({
    model,
    history: history
        .filter(h => h.role !== 'system')
        .map(h => ({ role: h.role, parts: [{ text: h.text }] })),
    config: { systemInstruction }
  });

  return chat;
};

/**
 * SEARCH TOOL (Grounding)
 * Uses Gemini 2.5 Flash with Google Search
 */
export const searchWeb = async (query: string): Promise<{text: string, chunks: any[]}> => {
    const client = getAI();
    const model = "gemini-2.5-flash";
  
    const response = await client.models.generateContent({
      model,
      contents: query,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });
    
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const text = response.text || "I found some information.";
    
    return { text, chunks };
};

/**
 * THINKING MODE
 * Uses Gemini 3 Pro with high budget for complex explanations
 */
export const askThinking = async (query: string, context: string): Promise<string> => {
    const client = getAI();
    const model = "gemini-3-pro-preview";
    
    const prompt = `
        Context: ${context}
        User Question: ${query}
        
        Please provide a deep, comprehensive explanation.
    `;

    const response = await client.models.generateContent({
        model,
        contents: prompt,
        config: {
            thinkingConfig: { thinkingBudget: 32768 }
        }
    });

    return response.text || "I analyzed the problem but couldn't generate a response.";
};

/**
 * QUIZ AGENT
 */
export const generateQuiz = async (topic: string, objective: string, level: string): Promise<QuizQuestion[]> => {
  const client = getAI();
  const model = "gemini-2.5-flash";

  const prompt = QUIZ_GENERATOR_PROMPT
    .replace('{{topic}}', topic)
    .replace('{{objective}}', objective)
    .replace('{{level}}', level);

  try {
    const response = await client.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });

    if (response.text) {
        return JSON.parse(response.text);
    }
    return [];
  } catch (e) {
    console.error("Quiz generation failed", e);
    return [];
  }
};

/**
 * FEEDBACK AGENT
 */
export const generateFeedback = async (topic: string, score: number, total: number, details: string): Promise<string> => {
    const client = getAI();
    const model = "gemini-2.5-flash";

    const prompt = FEEDBACK_AGENT_PROMPT
        .replace('{{topic}}', topic)
        .replace('{{score}}', score.toString())
        .replace('{{total}}', total.toString())
        .replace('{{details}}', details);

    const response = await client.models.generateContent({
        model,
        contents: prompt
    });

    return response.text || "Great job! Keep practicing.";
}
