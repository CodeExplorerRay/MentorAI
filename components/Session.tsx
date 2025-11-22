import React, { useState, useEffect, useRef } from 'react';
import { DayPlan, Message, QuizQuestion } from '../types';
import { ArrowLeft, Send, Sparkles, Code, PlayCircle, HelpCircle, CheckCircle, XCircle, User, Globe, BrainCircuit, Loader2, Terminal, Lightbulb, BookOpen, Mic, Paperclip, X, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { createCoachSession, generateQuiz, generateFeedback, searchWeb, askThinking } from '../services/geminiService';
import { LiveVoiceSession } from './LiveVoiceSession'; // Assuming this component exists
import { HybridDiagram } from './HybridDiagram'; // Corrected import
import { usePyodide } from '../hooks/usePyodide';
import ReactMarkdown from 'react-markdown';

interface SessionProps {
  plan: DayPlan;
  topic: string;
  onBack: () => void;
  onComplete: (score: number) => void;
}

export const Session: React.FC<SessionProps> = ({ plan, topic, onBack, onComplete }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatSession, setChatSession] = useState<any>(null);
  
  // Pyodide Hook
  const { isReady: isPyodideReady, isLoading: isPyodideLoading, runPython } = usePyodide();
  const [executionResults, setExecutionResults] = useState<Record<string, { output: string; isError: boolean; isRunning: boolean }>>({});
  
  // Image Upload State
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Modes
  const [mode, setMode] = useState<'chat' | 'search' | 'think'>('chat');
  const [showVoiceSession, setShowVoiceSession] = useState(false);
  
  // Quiz State
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Initial load
  useEffect(() => {
    const initialMsg: Message = {
      role: 'model',
      text: `**Day ${plan.day}: ${plan.title}**\n\nObjective: *${plan.objective}*.\n\nI'm your Coach (powered by Gemini 3 Pro). Let's start! Shall I explain the core concept first?`,
      timestamp: Date.now()
    };
    setMessages([initialMsg]);

    try {
        const chat = createCoachSession(topic, plan, []);
        setChatSession(chat);
    } catch (e) {
        console.error("Failed to init chat", e);
    }
  }, [plan, topic]);

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          // Validate image type
          if (!file.type.startsWith('image/')) {
              alert("Please upload an image file.");
              return;
          }
          
          const reader = new FileReader();
          reader.onloadend = () => {
              setSelectedImage(reader.result as string);
          };
          reader.readAsDataURL(file);
      }
  };

  const clearImage = () => {
      setSelectedImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRunCode = async (code: string, blockId: string) => {
      setExecutionResults(prev => ({
          ...prev,
          [blockId]: { output: '', isError: false, isRunning: true }
      }));

      const result = await runPython(code);

      setExecutionResults(prev => ({
          ...prev,
          [blockId]: { 
              output: result.success ? (result.output || "Code executed successfully (no output).") : result.output, 
              isError: !result.success, 
              isRunning: false 
          }
      }));
  };

  const handleSend = async () => {
    if (!input.trim() && !selectedImage) return;
    
    const userMsg: Message = { 
        role: 'user', 
        text: input, 
        image: selectedImage || undefined,
        timestamp: Date.now() 
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    
    setIsLoading(true);

    try {
      if (mode === 'search') {
          // Search Mode
          const { text, chunks } = await searchWeb(userMsg.text);
          setMessages(prev => [...prev, { 
              role: 'model', 
              text: text, 
              timestamp: Date.now(),
              groundingChunks: chunks
          }]);
      } else if (mode === 'think') {
          // Thinking Mode
          const placeholderId = Date.now();
          setMessages(prev => [...prev, { role: 'model', text: '', timestamp: placeholderId, isThinking: true }]);
          
          const context = messages.map(m => m.text).join('\n').slice(-2000);
          const text = await askThinking(userMsg.text, context);
          
          setMessages(prev => prev.map(m => 
            m.timestamp === placeholderId 
              ? { ...m, text: text, isThinking: false } 
              : m
          ));
      } else {
          // Standard Chat (Gemini 3 Pro) with Multimodal support
          if (!chatSession) throw new Error("Chat not initialized");
          
          let messagePayload: any = userMsg.text;

          // Construct multipart message if image is present
          if (userMsg.image) {
              const base64Data = userMsg.image.split(',')[1];
              const mimeType = userMsg.image.split(';')[0].split(':')[1];
              
              messagePayload = [
                  { text: userMsg.text || "Analyzed this image." },
                  { inlineData: { mimeType, data: base64Data } }
              ];
          }
          
          // Use strict object argument for sendMessageStream per SDK guidelines
          const result = await chatSession.sendMessageStream({ message: messagePayload });
          
          let fullText = '';
          const placeholderId = Date.now();
          setMessages(prev => [...prev, { role: 'model', text: '', timestamp: placeholderId, isThinking: true }]);

          for await (const chunk of result) {
            // Access text as property, not method
            const text = chunk.text;
            if (text) {
                fullText += text;
                setMessages(prev => prev.map(m => 
                m.timestamp === placeholderId 
                    ? { ...m, text: fullText, isThinking: false } 
                    : m
                ));
            }
          }
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', text: "Sorry, I encountered an error connecting to the agent. Please try again.", timestamp: Date.now() }]);
    }
    
    // Reset mode to chat after special actions
    if (mode !== 'chat') setMode('chat');
    setIsLoading(false);
  };

  const handleStartQuiz = async () => {
      setLoadingQuiz(true);
      try {
          const questions = await generateQuiz(topic, plan.objective, "Intermediate");
          setQuizQuestions(questions);
          setShowQuiz(true);
      } catch (e) {
          alert("Could not generate quiz. Try again.");
      }
      setLoadingQuiz(false);
  };

  const handleSubmitQuiz = async () => {
      let correctCount = 0;
      const details: string[] = [];
      
      quizQuestions.forEach(q => {
          const isCorrect = quizAnswers[q.id] === q.correctAnswer;
          if (isCorrect) correctCount++;
          details.push(`Q: ${q.question} | Student Answer: ${quizAnswers[q.id]} | Correct: ${q.correctAnswer}`);
      });

      setQuizSubmitted(true);
      
      // Call Feedback Agent
      const fb = await generateFeedback(topic, correctCount, quizQuestions.length, details.join('\n'));
      setFeedback(fb);
  };

  const handleFinishSession = () => {
      // Calculate score percentage
      const score = quizQuestions.length > 0 
        ? Math.round((Object.keys(quizAnswers).filter(k => quizAnswers[Number(k)] === quizQuestions.find(q => q.id === Number(k))?.correctAnswer).length / quizQuestions.length) * 100) 
        : 100; // Default to 100 if no quiz taken (just reading)
      
      onComplete(score);
  };

  const renderMessage = (msg: Message, msgIndex: number) => {
    return (
      <div className={`mb-6 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[90%] lg:max-w-[80%] flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${msg.role === 'user' ? 'bg-slate-800' : 'bg-indigo-600'}`}>
                {msg.role === 'user' ? <User size={14} className="text-white" /> : <Sparkles className="text-white" size={14} />}
            </div>
            <div className="flex flex-col gap-2 w-full">
                <div className={`prose prose-sm max-w-none p-4 rounded-2xl shadow-sm border ${
                    msg.role === 'user' 
                    ? 'bg-white border-slate-200 text-slate-800 rounded-tr-none' 
                    : 'bg-white border-indigo-100 text-slate-800 rounded-tl-none'
                }`}>
                    {/* Render User Image */}
                    {msg.image && (
                        <div className="mb-3 rounded-lg overflow-hidden border border-slate-100">
                            <img src={msg.image} alt="User upload" className="max-w-full h-auto max-h-[300px] object-contain bg-slate-50" />
                        </div>
                    )}

                    <ReactMarkdown
                        components={{
                            code({node, inline, className, children, ...props}: any) {
                                const match = /language-(\w+)/.exec(className || '')
                                const isMermaid = match && match[1] === 'mermaid';
                                const isPython = match && match[1] === 'python';
                                const codeContent = String(children).replace(/\n$/, '');
                                // Create a unique ID for this code block instance to track execution
                                const blockId = `${msg.timestamp}-${node?.position?.start?.line || 0}`; 
                                const execState = executionResults[blockId];

                                if (!inline && isMermaid) {
                                    return <HybridDiagram chart={codeContent} />; // Corrected component usage
                                }

                                return !inline && match ? (
                                <div className="my-4 rounded-lg overflow-hidden border border-slate-200 bg-slate-900 shadow-md group">
                                    <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
                                        <span className="text-xs text-slate-400 font-mono flex items-center gap-2">
                                          <Terminal size={12} />
                                          {match[1]}
                                        </span>
                                        {isPython && (
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => handleRunCode(codeContent, blockId)}
                                                    disabled={!isPyodideReady || execState?.isRunning}
                                                    className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20 hover:bg-emerald-400/20 transition-colors disabled:opacity-50"
                                                >
                                                    {execState?.isRunning ? <Loader2 size={10} className="animate-spin" /> : <PlayCircle size={10} />}
                                                    {execState?.isRunning ? "Running..." : "Run Code"}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4 overflow-x-auto bg-[#0d1117]">
                                        <code className={`${className} !bg-transparent !p-0 text-sm font-mono leading-relaxed`} {...props}>
                                            {children}
                                        </code>
                                    </div>
                                    
                                    {/* Execution Output Panel */}
                                    {isPython && execState && (
                                        <div className="border-t border-slate-800 bg-black/30 p-3 font-mono text-xs transition-all animate-in slide-in-from-top-2">
                                            {execState.isRunning ? (
                                                <div className="flex items-center gap-2 text-blue-300 animate-pulse">
                                                    <Loader2 size={12} className="animate-spin" />
                                                    <span>Executing on local runtime...</span>
                                                </div>
                                            ) : (
                                                <div className={`pl-3 border-l-2 ${execState.isError ? 'border-red-500/50 text-red-300' : 'border-emerald-500/50 text-emerald-300'}`}>
                                                    <div className="flex justify-between items-center opacity-50 mb-1 text-[10px] uppercase">
                                                        <span>Output</span>
                                                        <button onClick={() => setExecutionResults(prev => { const n = {...prev}; delete n[blockId]; return n; })} className="hover:text-white"><X size={10} /></button>
                                                    </div>
                                                    <pre className="whitespace-pre-wrap font-mono">{execState.output}</pre>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                ) : (
                                <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-800 font-mono text-xs border border-slate-200" {...props}>
                                    {children}
                                </code>
                                )
                            }
                        }}
                    >
                        {msg.text}
                    </ReactMarkdown>
                    
                    {/* Grounding Sources */}
                    {msg.groundingChunks && msg.groundingChunks.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-indigo-100/50">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                <Globe size={10} /> Sources
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {msg.groundingChunks.map((chunk: any, i: number) => (
                                    chunk.web?.uri ? (
                                        <a 
                                            key={i} 
                                            href={chunk.web.uri} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="text-xs bg-white text-indigo-600 px-2 py-1 rounded border border-indigo-100 hover:bg-indigo-50 transition-colors flex items-center gap-1 shadow-sm"
                                        >
                                            <Globe size={10} /> 
                                            <span className="truncate max-w-[150px]">{chunk.web.title || "Web Source"}</span>
                                        </a>
                                    ) : null
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 relative">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                <ArrowLeft size={20} />
            </button>
            <div>
                <h1 className="font-bold text-slate-800">{topic}</h1>
                <div className="flex items-center gap-2">
                    <p className="text-xs text-slate-500">Day {plan.day}: {plan.title}</p>
                    {isPyodideLoading && <span className="text-[10px] text-amber-500 flex items-center gap-1"><Loader2 size={8} className="animate-spin" /> Loading Python...</span>}
                    {isPyodideReady && <span className="text-[10px] text-emerald-600 flex items-center gap-1"><CheckCircle size={8} /> Python Ready</span>}
                </div>
            </div>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => setShowVoiceSession(true)}
                className="text-sm font-medium bg-rose-50 text-rose-600 hover:bg-rose-100 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
                <Mic size={14} /> Voice Mode
            </button>
            <button 
                onClick={handleStartQuiz}
                disabled={loadingQuiz || showQuiz}
                className="text-sm font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
                {loadingQuiz ? "Generating..." : "Take Daily Quiz"} <HelpCircle size={14} />
            </button>
            <button 
                onClick={handleFinishSession} 
                className="text-sm font-medium text-slate-600 hover:text-slate-800 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
                Leave Session
            </button>
        </div>
      </header>

      {/* Voice Session Overlay */}
      {showVoiceSession && (
          <LiveVoiceSession topic={topic} plan={plan} onClose={() => setShowVoiceSession(false)} />
      )}

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-8" ref={scrollRef}>
        <div className="max-w-3xl mx-auto">
            {messages.map((msg, idx) => (
                <div key={idx}>{renderMessage(msg, idx)}</div>
            ))}
            {isLoading && (
                <div className="flex justify-start mb-6">
                     <div className="ml-12 bg-white border border-indigo-50 p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
                        <span className="text-xs text-indigo-400 font-medium ml-1">
                            {mode === 'think' ? 'Thinking intensely...' : mode === 'search' ? 'Searching web...' : 'Gemini 3 is typing...'}
                        </span>
                     </div>
                </div>
            )}
        </div>
      </div>

      {/* Quiz Overlay */}
      {showQuiz && (
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm z-20 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                      <h2 className="text-xl font-bold text-slate-800">Daily Knowledge Check</h2>
                      {!quizSubmitted && (
                        <button onClick={() => setShowQuiz(false)} className="text-slate-400 hover:text-slate-600">
                            <XCircle size={24} />
                        </button>
                      )}
                  </div>
                  
                  <div className="p-6 space-y-8">
                      {quizSubmitted && feedback && (
                          <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 mb-6">
                              <h3 className="font-bold text-indigo-800 mb-2 flex items-center gap-2">
                                  <Sparkles size={16} /> Feedback Agent Report
                              </h3>
                              <div className="text-sm text-indigo-900 prose prose-sm max-w-none">
                                <ReactMarkdown>
                                    {feedback}
                                </ReactMarkdown>
                              </div>
                          </div>
                      )}

                      {quizQuestions.map((q, idx) => (
                          <div key={q.id} className="space-y-3">
                              <p className="font-medium text-slate-800 text-lg">
                                  <span className="text-slate-400 mr-2">{idx + 1}.</span>
                                  {q.question}
                              </p>
                              <div className="grid grid-cols-1 gap-2 pl-6">
                                  {q.options.map((opt) => {
                                      const isSelected = quizAnswers[q.id] === opt;
                                      const isCorrect = opt === q.correctAnswer;
                                      
                                      let itemClass = "border-slate-200 hover:bg-slate-50";
                                      if (quizSubmitted) {
                                          if (isCorrect) itemClass = "border-emerald-500 bg-emerald-50 text-emerald-700";
                                          else if (isSelected && !isCorrect) itemClass = "border-red-300 bg-red-50 text-red-700";
                                          else itemClass = "border-slate-100 opacity-50";
                                      } else if (isSelected) {
                                          itemClass = "border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600";
                                      }

                                      return (
                                        <button
                                            key={opt}
                                            disabled={quizSubmitted}
                                            onClick={() => setQuizAnswers(prev => ({ ...prev, [q.id]: opt }))}
                                            className={`text-left p-3 rounded-lg border transition-all flex items-center justify-between ${itemClass}`}
                                        >
                                            <span>{opt}</span>
                                            {quizSubmitted && isCorrect && <CheckCircle size={16} />}
                                            {quizSubmitted && isSelected && !isCorrect && <XCircle size={16} />}
                                        </button>
                                      );
                                  })}
                              </div>
                              {quizSubmitted && (
                                  <div className="pl-6 space-y-2">
                                      <div className="text-sm text-slate-500 italic border-l-2 border-slate-300 pl-3">
                                          {q.explanation}
                                      </div>
                                      {quizAnswers[q.id] !== q.correctAnswer && (
                                          <div className="flex flex-col gap-1 mt-2 animate-in fade-in slide-in-from-top-2">
                                               {q.hint && (
                                                   <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-100">
                                                       <Lightbulb size={12} />
                                                       <span className="font-semibold">Hint:</span> {q.hint}
                                                   </div>
                                               )}
                                               {q.resource && (
                                                   <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 p-2 rounded border border-blue-100">
                                                       <BookOpen size={12} />
                                                       <span className="font-semibold">Learn More:</span> 
                                                       <span className="inline">
                                                            <ReactMarkdown components={{p: ({children}) => <span>{children}</span>}}>{q.resource}</ReactMarkdown>
                                                       </span>
                                                   </div>
                                               )}
                                          </div>
                                      )}
                                  </div>
                              )}
                          </div>
                      ))}
                  </div>

                  <div className="p-6 border-t border-slate-100 bg-slate-50">
                      {!quizSubmitted ? (
                          <button 
                            onClick={handleSubmitQuiz}
                            disabled={Object.keys(quizAnswers).length < quizQuestions.length}
                            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                          >
                              Submit Answers
                          </button>
                      ) : (
                          <button 
                            onClick={handleFinishSession}
                            className="w-full py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-all"
                          >
                              Complete Session
                          </button>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* Input Area */}
      <div className="bg-white border-t border-slate-200 p-4 shrink-0">
        <div className="max-w-3xl mx-auto relative">
            {/* Mode Toggles */}
            <div className="flex gap-2 mb-2">
                <button 
                    onClick={() => setMode('chat')} 
                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all flex items-center gap-1.5 ${mode === 'chat' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                    <Sparkles size={12} /> Chat
                </button>
                <button 
                    onClick={() => setMode('search')} 
                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all flex items-center gap-1.5 ${mode === 'search' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                    <Globe size={12} /> Search Grounding
                </button>
                <button 
                    onClick={() => setMode('think')} 
                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all flex items-center gap-1.5 ${mode === 'think' ? 'bg-purple-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                    <BrainCircuit size={12} /> Deep Think
                </button>
            </div>

            {/* Image Preview */}
            {selectedImage && (
                <div className="absolute bottom-full left-0 mb-2 p-2 bg-white rounded-xl border border-slate-200 shadow-lg animate-in slide-in-from-bottom-2 z-10">
                    <div className="relative">
                        <img src={selectedImage} alt="Preview" className="h-20 w-auto rounded-lg object-cover" />
                        <button 
                            onClick={clearImage}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-sm hover:bg-red-600 transition-colors"
                        >
                            <X size={12} />
                        </button>
                    </div>
                </div>
            )}

            <div className="relative flex items-end gap-2">
                {/* Image Upload Button */}
                <div className="relative">
                     <input 
                         type="file" 
                         ref={fileInputRef} 
                         className="hidden" 
                         accept="image/*" 
                         onChange={handleFileSelect}
                     />
                     <button
                         onClick={() => fileInputRef.current?.click()}
                         disabled={mode !== 'chat' || isLoading}
                         className={`p-3 rounded-xl border transition-colors flex items-center justify-center ${
                             mode === 'chat' 
                             ? 'border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-indigo-600' 
                             : 'border-slate-100 text-slate-300 cursor-not-allowed'
                         }`}
                         title={mode === 'chat' ? "Upload image for analysis" : "Image upload available in Chat mode only"}
                     >
                         <Paperclip size={20} />
                     </button>
                </div>

                <div className="relative flex-1">
                    <textarea
                        className={`w-full pl-4 pr-12 py-3 rounded-xl border focus:ring-2 focus:border-transparent resize-none shadow-sm transition-all ${
                            mode === 'search' ? 'focus:ring-blue-500 border-blue-100 bg-blue-50/30' :
                            mode === 'think' ? 'focus:ring-purple-500 border-purple-100 bg-purple-50/30' :
                            'focus:ring-indigo-500 border-slate-200 bg-slate-50 focus:bg-white'
                        }`}
                        rows={1}
                        placeholder={
                            mode === 'search' ? "Ask for real-time info (e.g., 'latest version of React')..." :
                            mode === 'think' ? "Ask a complex question (e.g., 'Explain the math behind Backprop')..." :
                            selectedImage ? "Add a comment about this image..." : "Ask your coach..."
                        }
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if(e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                    />
                    <button 
                        onClick={handleSend}
                        disabled={isLoading || (!input.trim() && !selectedImage)}
                        className={`absolute right-2 top-2 p-2 text-white rounded-lg disabled:opacity-50 transition-colors ${
                            mode === 'search' ? 'bg-blue-600 hover:bg-blue-700' :
                            mode === 'think' ? 'bg-purple-600 hover:bg-purple-700' :
                            'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                    >
                        <Send size={16} />
                    </button>
                </div>
            </div>
        </div>
        <div className="text-center mt-2 flex items-center justify-center gap-4">
            <p className={`text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1 transition-colors ${isPyodideReady ? 'text-emerald-600' : 'text-slate-400'}`}>
                <Code size={10} /> {isPyodideReady ? "Sandbox Ready (Pyodide)" : isPyodideLoading ? "Sandbox Loading..." : "Sandbox Inactive"}
            </p>
        </div>
      </div>
    </div>
  );
};