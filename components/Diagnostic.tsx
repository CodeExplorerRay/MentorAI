
import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, CheckCircle2, Paperclip, X, FileText } from 'lucide-react';
import { runDiagnosticTurn } from '../services/geminiService';
import { Message, UserProfile } from '../types';
import ReactMarkdown from 'react-markdown';

interface DiagnosticProps {
  onComplete: (profile: UserProfile) => void;
}

export const Diagnostic: React.FC<DiagnosticProps> = ({ onComplete }) => {
  const [topic, setTopic] = useState('');
  const [started, setStarted] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      text: "Hi! I'm your **Diagnostic Agent**. I can build a custom 30-day learning plan for you.\n\n**How would you like to start?**\n\n1. Tell me what you want to learn.\n2. Upload your **Resume**, **Syllabus**, or a **Job Description** you're targeting.",
      timestamp: Date.now()
    }
  ]);
  const [quickReplies, setQuickReplies] = useState<string[]>(['Learn Python', 'Learn Spanish', 'Learn React', 'Upload Resume']);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, quickReplies]);

  const extractChips = (text: string): { cleanText: string, chips: string[] } => {
    const chipMatch = text.match(/\[CHIPS: (.*?)\]/);
    if (chipMatch) {
        const chips = chipMatch[1].split(',').map(s => s.trim());
        const cleanText = text.replace(chipMatch[0], '').trim();
        return { cleanText, chips };
    }
    return { cleanText: text, chips: [] };
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            setSelectedFile(reader.result as string);
            setInput(`[Attached: ${file.name}] Analyze this file to determine my skill level.`);
        };
        reader.readAsDataURL(file);
    }
  };

  const handleSend = async (overrideInput?: string) => {
    const textToSend = overrideInput || input;
    if (!textToSend.trim() && !selectedFile) return;
    
    // Handle "Upload Resume" quick action click
    if (textToSend === 'Upload Resume') {
        fileInputRef.current?.click();
        return;
    }

    const userMsg: Message = { 
        role: 'user', 
        text: textToSend, 
        image: selectedFile || undefined,
        timestamp: Date.now() 
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput('');
    setQuickReplies([]); // Clear old chips
    setLoading(true);
    
    // If we just sent a file, clear it
    const fileToSend = selectedFile;
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    // First interaction logic
    if (!started) {
      setTopic(textToSend); // Loose approximation, will be refined by agent
      setStarted(true);
      try {
        const response = await runDiagnosticTurn([], `My goal/input is: ${textToSend}`, textToSend, fileToSend || undefined); 
        const { cleanText, chips } = extractChips(response);
        
        setMessages(prev => [...prev, { role: 'model', text: cleanText, timestamp: Date.now() }]);
        setQuickReplies(chips);
      } catch (e) {
        setMessages(prev => [...prev, { role: 'model', text: "Connection error. Please check your API Key.", timestamp: Date.now() }]);
      }
      setLoading(false);
      return;
    }

    // Subsequent interactions
    try {
      const responseText = await runDiagnosticTurn(newHistory, textToSend, topic, fileToSend || undefined);
      
      // Check for completion tag
      if (responseText.includes("[DIAGNOSIS_COMPLETE]")) {
        const [displayText, jsonPart] = responseText.split("[DIAGNOSIS_COMPLETE]");
        
        if (displayText.trim()) {
            const { cleanText } = extractChips(displayText);
            setMessages(prev => [...prev, { role: 'model', text: cleanText.trim(), timestamp: Date.now() }]);
        }

        try {
            const profileData = JSON.parse(jsonPart.trim());
            setTimeout(() => {
                onComplete({
                    name: "Learner",
                    goal: profileData.goal || topic,
                    level: profileData.level || "Intermediate",
                    style: profileData.style || "Adaptive",
                    competencyVector: profileData.competencyVector || {},
                    stats: { streak: 0, totalPoints: 0, lastActivityDate: null, badges: [] }
                });
            }, 2500);
        } catch (e) {
            // Fallback
            onComplete({
                name: "Learner",
                goal: topic,
                level: "Intermediate",
                style: "Adaptive",
                competencyVector: {},
                stats: { streak: 0, totalPoints: 0, lastActivityDate: null, badges: [] }
            });
        }

      } else {
        const { cleanText, chips } = extractChips(responseText);
        setMessages(prev => [...prev, { role: 'model', text: cleanText, timestamp: Date.now() }]);
        setQuickReplies(chips);
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', text: "Error processing response.", timestamp: Date.now() }]);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto p-4">
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2" ref={scrollRef}>
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-indigo-600' : 'bg-emerald-600'}`}>
                {msg.role === 'user' ? <User size={16} className="text-white" /> : <Bot size={16} className="text-white" />}
              </div>
              <div className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-tr-none' 
                  : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
              }`}>
                 {msg.image && (
                     <div className="mb-2 bg-slate-100 p-2 rounded flex items-center gap-2 text-indigo-700 text-xs font-bold">
                         <FileText size={14} /> Attached File Analysis
                     </div>
                 )}
                 <ReactMarkdown>{msg.text}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
             <div className="flex gap-3 items-center">
                <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center animate-pulse">
                  <Bot size={16} className="text-white" />
                </div>
                <span className="text-slate-400 text-xs italic">Diagnostic Agent is analyzing...</span>
             </div>
          </div>
        )}
      </div>

      {/* Quick Reply Chips */}
      {!loading && quickReplies.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2 justify-end animate-in slide-in-from-bottom-2">
              {quickReplies.map((chip, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(chip)}
                    className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-full text-sm font-medium border border-indigo-100 hover:bg-indigo-100 hover:border-indigo-200 transition-all"
                  >
                      {chip}
                  </button>
              ))}
          </div>
      )}

      <div className="mt-auto">
        {selectedFile && (
             <div className="mb-2 p-2 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-between">
                 <div className="flex items-center gap-2 text-sm text-indigo-700">
                     <FileText size={16} />
                     <span className="font-medium">File Ready for Analysis</span>
                 </div>
                 <button onClick={() => { setSelectedFile(null); if(fileInputRef.current) fileInputRef.current.value='' }} className="text-slate-400 hover:text-red-500">
                     <X size={16} />
                 </button>
             </div>
        )}

        <div className="relative">
          <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*,.pdf,.txt" // Simplified accept for now
              onChange={handleFileSelect}
          />
          <input
            type="text"
            className="w-full p-4 pl-12 pr-12 rounded-xl border border-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            placeholder={started ? "Type your answer..." : "E.g. 'Learn Python' or upload resume..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={loading}
          />
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="absolute left-2 top-2 p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors"
            title="Upload Resume or Syllabus"
          >
              <Paperclip size={20} />
          </button>

          <button 
            onClick={() => handleSend()}
            disabled={loading || (!input.trim() && !selectedFile)}
            className="absolute right-2 top-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
        <p className="text-center text-xs text-slate-400 mt-3">
          AI Agent assessing: <strong>Knowledge Gap</strong> • <strong>Learning Style</strong> • <strong>Goals</strong>
        </p>
      </div>
    </div>
  );
};
