import React from 'react';
import ReactMarkdown from 'react-markdown';
import { HybridDiagram } from './MermaidDiagram';  // ← MUST BE HybridDiagram
import { Lightbulb, User } from 'lucide-react';

interface Message {
  role: 'user' | 'model';
  content: string;
}

interface CoachingAgentProps {
  messages: Message[];
}

// Helper to identify if a code block is a Mermaid chart
const isMermaidChart = (text: string): boolean => {
  const trimmedText = text.trim();
  return trimmedText.startsWith('```mermaid') || trimmedText.startsWith('graph');
};

const extractMermaidCode = (text: string): string => {
  return text.replace(/```mermaid/g, '').replace(/```/g, '').trim();
};

export const CoachingAgent: React.FC<CoachingAgentProps> = ({ messages }) => {
  return (
    <div className="space-y-6">
      {messages.map((message, index) => (
        <div key={index} className={`flex items-start gap-4 ${message.role === 'user' ? 'justify-end' : ''}`}>
          {message.role === 'model' && (
            <div className="bg-slate-200 p-2 rounded-full">
              <Lightbulb className="h-5 w-5 text-slate-600" />
            </div>
          )}
          <div className={`max-w-2xl p-4 rounded-2xl ${
              message.role === 'user'
                ? 'bg-blue-500 text-white rounded-br-none'
                : 'bg-slate-100 text-slate-800 rounded-bl-none'
            }`}
          >
            {isMermaidChart(message.content) ? (
              // ↓↓↓ THIS MUST BE HybridDiagram ↓↓↓
              <HybridDiagram chart={extractMermaidCode(message.content)} />
            ) : (
              <ReactMarkdown className="prose prose-slate max-w-none">
                {message.content}
              </ReactMarkdown>
            )}
          </div>
          {message.role === 'user' && (
            <div className="bg-slate-200 p-2 rounded-full">
              <User className="h-5 w-5 text-slate-600" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};