import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { Mic, MicOff, PhoneOff, Loader2, AudioLines, X, AlertCircle } from 'lucide-react';
import { DayPlan } from '../types';
import { VOICE_COACH_INSTRUCTION } from '../services/prompts';

interface LiveVoiceSessionProps {
  topic: string;
  plan: DayPlan;
  onClose: () => void;
}

// Audio Helper Functions (PCM Encoding/Decoding)
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createBlob(data: Float32Array) {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: btoa(String.fromCharCode(...new Uint8Array(int16.buffer))),
    mimeType: 'audio/pcm;rate=16000',
  };
}

export const LiveVoiceSession: React.FC<LiveVoiceSessionProps> = ({ topic, plan, onClose }) => {
  const [connected, setConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Initializing...");

  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const initSession = async () => {
      try {
        if (!process.env.API_KEY) throw new Error("API Key missing");
        
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("Your browser does not support audio recording.");
        }

        setStatus("Requesting Mic...");
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                sampleRate: 16000,
                channelCount: 1,
                echoCancellation: true
            } 
        });
        streamRef.current = stream;

        setStatus("Connecting to Gemini...");

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        // Audio Contexts
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const inputAudioContext = new AudioContextClass({ sampleRate: 16000 });
        const outputAudioContext = new AudioContextClass({ sampleRate: 24000 });
        
        // Resume contexts to handle browser autoplay policies
        await inputAudioContext.resume();
        await outputAudioContext.resume();
        
        inputContextRef.current = inputAudioContext;
        outputContextRef.current = outputAudioContext;

        const systemInstruction = VOICE_COACH_INSTRUCTION(topic, plan);

        const sessionPromise = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-09-2025',
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
            },
            systemInstruction: systemInstruction,
          },
          callbacks: {
            onopen: () => {
              setConnected(true);
              setStatus("Listening");
              
              const source = inputAudioContext.createMediaStreamSource(stream);
              const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
              
              scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                if (inputContextRef.current?.state === 'suspended') return;
                
                const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                const pcmBlob = createBlob(inputData);
                
                sessionPromise.then((session) => {
                  session.sendRealtimeInput({ media: pcmBlob });
                });
              };
              
              source.connect(scriptProcessor);
              scriptProcessor.connect(inputAudioContext.destination);
            },
            onmessage: async (message: LiveServerMessage) => {
              const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
              
              if (base64EncodedAudioString) {
                setStatus("Speaking...");
                const ctx = outputContextRef.current;
                if (!ctx) return;

                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                
                const audioBuffer = await decodeAudioData(
                  decode(base64EncodedAudioString),
                  ctx,
                  24000,
                  1
                );
                
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(ctx.destination);
                
                source.addEventListener('ended', () => {
                  sourcesRef.current.delete(source);
                  if (sourcesRef.current.size === 0) {
                      setStatus("Listening");
                  }
                });

                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                sourcesRef.current.add(source);
              }

              if (message.serverContent?.interrupted) {
                sourcesRef.current.forEach(s => s.stop());
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
                setStatus("Interrupted");
              }
            },
            onerror: (e) => {
              console.error("Session error", e);
            },
            onclose: () => {
              setConnected(false);
              setStatus("Disconnected");
            }
          }
        });

        sessionPromiseRef.current = sessionPromise;

      } catch (err: any) {
        console.error("Failed to start live session", err);
        if (err.name === 'NotAllowedError' || err.message.includes('Permission denied') || err.message.includes('dismissed')) {
             setError("Microphone access denied. Click the icon in your address bar to reset permissions.");
        } else {
             setError(err.message || "Failed to start session.");
        }
      }
    };

    initSession();

    return () => {
      sessionPromiseRef.current?.then(session => session.close());
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      if (inputContextRef.current) inputContextRef.current.close();
      if (outputContextRef.current) outputContextRef.current.close();
      
      sourcesRef.current.forEach(s => s.stop());
    };
  }, [topic, plan]);

  const toggleMute = () => {
    if (inputContextRef.current) {
      if (isMuted) {
        inputContextRef.current.resume();
      } else {
        inputContextRef.current.suspend();
      }
      setIsMuted(!isMuted);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md p-8 rounded-3xl bg-gradient-to-b from-slate-800 to-slate-900 shadow-2xl border border-slate-700 flex flex-col items-center text-center relative">
        
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
        >
          <X size={24} />
        </button>

        <div className="relative mb-8 mt-4">
          <div className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 ${
            status === 'Speaking...' 
              ? 'bg-indigo-500 shadow-[0_0_60px_-10px_rgba(99,102,241,0.5)] scale-105' 
              : error 
                ? 'bg-red-900/50 ring-2 ring-red-500'
                : 'bg-slate-700'
          }`}>
            {error ? (
                <AlertCircle size={48} className="text-red-400" />
            ) : connected ? (
               <AudioLines size={48} className={`text-white ${status === 'Speaking...' ? 'animate-pulse' : ''}`} />
            ) : (
               <Loader2 size={48} className="text-slate-400 animate-spin" />
            )}
          </div>
          {status === 'Speaking...' && !error && (
            <>
                <div className="absolute inset-0 rounded-full border border-indigo-500/50 animate-[ping_2s_ease-out_infinite]" />
                <div className="absolute inset-0 rounded-full border border-indigo-400/30 animate-[ping_2s_ease-out_infinite_0.5s]" />
            </>
          )}
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">AI Tutor Live</h2>
        <p className="text-slate-400 mb-6 min-h-[24px] font-medium">
            {error ? <span className="text-red-400">{error}</span> : status}
        </p>

        {!error && (
            <div className="flex gap-6 items-center">
            <button
                onClick={toggleMute}
                className={`p-5 rounded-full transition-all duration-200 ${
                isMuted 
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 ring-1 ring-red-500/50' 
                    : 'bg-slate-700 text-white hover:bg-slate-600'
                }`}
            >
                {isMuted ? <MicOff size={28} /> : <Mic size={28} />}
            </button>
            
            <button
                onClick={onClose}
                className="p-5 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors shadow-lg shadow-red-900/20"
            >
                <PhoneOff size={28} />
            </button>
            </div>
        )}
        
        {error && (
             <button 
                onClick={onClose}
                className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-full transition-colors"
             >
                Close
             </button>
        )}

        <p className="mt-8 text-xs text-slate-500 max-w-[200px]">
            Powered by Gemini 2.5 Flash Native Audio (Live API)
        </p>
      </div>
    </div>
  );
};