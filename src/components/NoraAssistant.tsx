
'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/firebase/auth/use-user';
import { X, Bot, Trash2, Loader2, Send, Volume2, VolumeX, Mic, MicOff, Paperclip, Square } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { motion, useDragControls } from 'framer-motion';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface NoraAssistantProps {
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
}

export default function NoraAssistant({ isOpen, setOpen }: NoraAssistantProps) {
  const { userProfile, company } = useAuth();
  const { toast } = useToast();
  const pathname = usePathname();
  const router = useRouter();
  
  const dragControls = useDragControls();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false); // Disabled by default for stability
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const recognitionRef = useRef<any>(null);
  const isSpeechRecognitionActiveRef = useRef(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userProfile) return;

    setLoading(true);
    
    // Add temporary message
    const userMsg: Message = { role: 'user', content: `[Enviando arquivo: ${file.name}...]`, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);

    try {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const base64Data = reader.result as string;
            
            // Call our Vision API
            const response = await fetch('/api/media/vision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    base64Image: base64Data,
                    mimeType: file.type
                })
            });
            
            const data = await response.json();
            
            if (data.text) {
                // Update the temporary message with the vision result and send to NORA
                const finalContent = `[IMAGEM RECEBIDA] Arquivo original: ${file.name}\n\n[TEXTO EXTRAÍDO DA IMAGEM PELO SISTEMA DE VISÃO]:\n${data.text}\n\n[FIM DO TEXTO DA IMAGEM] Analise este documento e me diga o que deseja fazer.`;
                
                // Replace the temporary message in local state
                setMessages(prev => {
                    const newMsgs = [...prev];
                    newMsgs[newMsgs.length - 1].content = `[Arquivo processado: ${file.name}]`;
                    return newMsgs;
                });
                
                // Trigger normal handleSend with the extracted text (hidden from user view, but sent to AI)
                handleSendInternal(finalContent);
            } else {
                toast({ title: 'Erro', description: 'Não foi possível ler a imagem.', variant: 'destructive' });
                setLoading(false);
            }
        };
    } catch (err) {
        console.error("Erro no upload:", err);
        setLoading(false);
    }
  };

  const startSpeechRecognition = () => {
    if (typeof window === 'undefined') return false;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return false;

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      const baseText = input.trim();

      recognition.onstart = () => {
        setIsRecording(true);
        isSpeechRecognitionActiveRef.current = true;
      };

      recognition.onresult = (event: any) => {
        let currentInterim = '';
        let currentFinal = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            currentFinal += event.results[i][0].transcript;
          } else {
            currentInterim += event.results[i][0].transcript;
          }
        }

        const speechText = (currentFinal + ' ' + currentInterim).trim();
        const combined = baseText ? `${baseText} ${speechText}` : speechText;
        if (combined) {
          setInput(combined);
          if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 130)}px`;
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('SpeechRecognition erro:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          toast({ title: 'Microfone bloqueado', description: 'Permita o acesso ao microfone no navegador.', variant: 'destructive' });
        }
        setIsRecording(false);
        isSpeechRecognitionActiveRef.current = false;
      };

      recognition.onend = () => {
        setIsRecording(false);
        isSpeechRecognitionActiveRef.current = false;
        setTimeout(() => inputRef.current?.focus(), 100);
      };

      recognitionRef.current = recognition;
      recognition.start();
      return true;
    } catch (e) {
      console.warn('Falha ao iniciar SpeechRecognition, usando MediaRecorder:', e);
      return false;
    }
  };

  const startMediaRecorder = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        
        setLoading(true);
        const userMsg: Message = { role: 'user', content: '[Transcrevendo áudio...]', timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);

        const formData = new FormData();
        formData.append('file', audioBlob, 'voice.webm');

        try {
          const response = await fetch('/api/media/transcribe', {
            method: 'POST',
            body: formData
          });
          const data = await response.json();
          
          if (data.text && data.text.trim()) {
            const transcribedText = data.text.trim();
            setMessages(prev => {
              const newMsgs = [...prev];
              newMsgs[newMsgs.length - 1].content = `🎙️ ${transcribedText}`;
              return newMsgs;
            });
            handleSendInternal(`[Áudio do usuário transcrito]: "${transcribedText}"`);
          } else {
            toast({ title: 'Aviso', description: data.error || 'Não foi possível identificar o áudio. Tente novamente.', variant: 'destructive' });
            setMessages(prev => prev.slice(0, -1));
            setLoading(false);
          }
        } catch (err) {
          console.error("Erro no áudio:", err);
          toast({ title: 'Erro', description: 'Falha ao processar áudio.', variant: 'destructive' });
          setMessages(prev => prev.slice(0, -1));
          setLoading(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      toast({ title: 'Permissão negada', description: 'Libere o microfone no navegador.', variant: 'destructive' });
      setIsRecording(false);
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      if (isSpeechRecognitionActiveRef.current && recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
        isSpeechRecognitionActiveRef.current = false;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch (e) {}
      }
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (SpeechRecognition) {
      const started = startSpeechRecognition();
      if (!started) {
        await startMediaRecorder();
      }
    } else {
      await startMediaRecorder();
    }
  };

  // Clean up on unmount or close
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch (e) {}
      }
    };
  }, []);

  // Separated the backend call so we can call it transparently from media uploads
  const handleSendInternal = async (contentToSend: string) => {
    try {
      const response = await fetch('/api/xcot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            // append this message to the history explicitly
            messages: [...messages, { role: 'user', content: contentToSend }].map(({ role, content }) => ({ role, content })),
            userContext: {
                uid: userProfile?.uid || '',
                companyId: userProfile?.companyId || '',
                companyName: company?.name || 'empresa',
                role: userProfile?.role || 'cliente',
                displayName: userProfile?.displayName || 'Usuário',
                clientId: userProfile?.clientId || '',
                currentPath: pathname
            }
        }),
      });

      const data = await response.json();
      
      // ... process actions
      if (data.actions && Array.isArray(data.actions)) {
          data.actions.forEach((action: any, index: number) => {
              const delay = index * 600;
              setTimeout(() => {
                  const isFenceAction = action.type.includes('fence');
                  const targetPath = '/orcamentos/cerca-eletrica';
                  if (isFenceAction) {
                      const cleanCurrentPath = window.location.pathname.replace(/\/$/, "");
                      const cleanTargetPath = targetPath.replace(/\/$/, "");
                      if (cleanCurrentPath !== cleanTargetPath) {
                          router.push(`${targetPath}?noraTrigger=${action.type}&noraData=${encodeURIComponent(JSON.stringify(action.data || {}))}`);
                          return; 
                      }
                  }
                  window.dispatchEvent(new CustomEvent('nora-action', { detail: action }));
                  if (action.type === 'fill_fence_form') window.dispatchEvent(new CustomEvent('nora-fill-fence-form', { detail: action.data }));
                  if (action.type === 'save_fence_quote') window.dispatchEvent(new CustomEvent('nora-save-fence-quote'));
              }, delay);
          });
      }

      const assistantMsg: Message = {
        role: 'assistant',
        content: data.response || data.error || "Erro ao processar.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Ops, erro na conexão.`, timestamp: new Date() }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };


  const getInitialMessage = useCallback((): Message => {
    const firstName = userProfile?.displayName?.split(' ')[0] || '';
    const greeting = firstName ? `Olá ${firstName},` : 'Olá,';
    return {
      role: 'assistant',
      content: `${greeting} Como posso ajudar 😊`,
      timestamp: new Date()
    };
  }, [company, userProfile]);

  const productSuggestions = useMemo(() => {
    return (company?.products || []).map(p => p.description).filter(Boolean);
  }, [company]);



  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 130)}px`;
    }
  };

  const handleSend = useCallback(async (messageText: string) => {
    const text = messageText.trim();
    if (!text || loading || !userProfile) return;
    
    // If user sends while recording, stop recording
    if (isRecording) {
      if (isSpeechRecognitionActiveRef.current && recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setIsRecording(false);
    }

    setInput('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
    const userMsg: Message = { role: 'user', content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    await handleSendInternal(text);
  }, [loading, userProfile, company, messages, router, pathname, isRecording]);



  useEffect(() => {
    if (userProfile && messages.length === 0) {
      setMessages([getInitialMessage()]);
    }
  }, [userProfile, messages.length, getInitialMessage]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300); // Esperar a transição de abertura
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <motion.div 
      drag
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      style={{ touchAction: 'none' }}
      className={cn(
        "fixed bottom-4 right-4 w-[90vw] sm:w-[450px] h-[80vh] sm:h-[600px] min-w-[300px] min-h-[400px] max-w-[100vw] max-h-[100vh] bg-background rounded-xl shadow-2xl border border-border flex flex-col z-50 overflow-hidden resize transition-opacity duration-300",
        !isOpen && "opacity-0 pointer-events-none"
      )}
    >
      <div 
        className="bg-primary text-primary-foreground p-4 shrink-0 cursor-move"
        onPointerDown={(e) => dragControls.start(e)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className={cn(
                "w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center mr-3 border border-primary-foreground/10",
                isSpeaking && "animate-pulse"
            )}>
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-lg leading-none">
                {userProfile?.role === 'cliente' ? 'NORA Concierge' : 
                 userProfile?.role === 'tecnico' ? 'NORA Technical Advisor' : 
                 'NORA Pro'}
              </h3>
              <p className="text-[10px] text-primary-foreground/70 mt-1">
                {userProfile?.role === 'cliente' ? 'Suporte ao Cliente' : 
                 userProfile?.role === 'tecnico' ? 'Suporte Técnico de Campo' : 
                 'Especialista Operacional'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground" onClick={() => setMessages([getInitialMessage()])}>
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground" onClick={() => setOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 bg-muted/30 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={cn(
              "p-3 rounded-2xl max-w-[85%] shadow-sm text-sm",
              msg.role === 'user' ? "bg-primary text-primary-foreground rounded-br-none" : "bg-card border border-border text-card-foreground rounded-bl-none"
            )}>
              <p className="whitespace-pre-wrap">
                {msg.content.split(/(\[\[ azul: .*? \]\])/g).map((part, i) => {
                  if (part.startsWith('[[ azul: ') && part.endsWith(' ]]')) {
                    const text = part.replace('[[ azul: ', '').replace(' ]]', '');
                    return <span key={i} className="text-blue-600 dark:text-blue-400 font-semibold underline decoration-blue-500/30 decoration-2 underline-offset-4">{text}</span>;
                  }
                  return part;
                })}
              </p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="p-3 rounded-2xl bg-muted text-muted-foreground flex items-center gap-2 animate-pulse text-xs">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Processando...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {isRecording && (
        <div className="bg-red-50 dark:bg-red-950/40 border-t border-red-200 dark:border-red-900/50 px-4 py-2 flex items-center justify-between text-xs text-red-600 dark:text-red-400 animate-pulse">
          <div className="flex items-center gap-2 font-medium">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
            <span>Ouvindo sua voz em tempo real... Fale com a NORA</span>
          </div>
          <button 
            type="button"
            onClick={toggleRecording} 
            className="text-red-700 dark:text-red-300 hover:underline font-semibold text-[11px]"
          >
            Finalizar fala
          </button>
        </div>
      )}

      <div className="p-4 border-t bg-background shrink-0 pb-6">
        <div className="flex gap-2 items-end">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*,application/pdf"
            onChange={handleFileUpload} 
          />
          <Button 
            variant="ghost" 
            size="icon" 
            className="shrink-0 h-10 w-10 mb-[1px] text-muted-foreground"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || isRecording}
            title="Anexar arquivo ou imagem"
          >
            <Paperclip className="h-5 w-5" />
          </Button>

          <textarea 
            ref={inputRef}
            rows={1}
            value={input} 
            onChange={handleInputChange} 
            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => { 
                if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) { 
                    e.preventDefault();
                    handleSend(input); 
                } 
            }} 
            placeholder={isRecording ? "Ouvindo... O texto aparecerá aqui..." : "Digite sua mensagem..."} 
            className={cn(
                "flex-1 min-h-[40px] max-h-32 border border-input rounded-xl px-3.5 py-2.5 text-sm bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all resize-none overflow-y-auto leading-relaxed shadow-sm",
                isRecording && "border-red-400 ring-2 ring-red-200 dark:ring-red-900/40 bg-red-50/50 dark:bg-red-950/20"
            )} 
            disabled={loading} 
          />

          {isRecording ? (
            <Button 
              variant="destructive" 
              size="icon" 
              className="shrink-0 h-10 w-10 mb-[1px] animate-pulse bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/20"
              onClick={toggleRecording}
              disabled={loading}
              title="Clique para parar de gravar"
            >
              <Square className="h-4 w-4 fill-current" />
            </Button>
          ) : !input.trim() ? (
            <Button 
              variant="ghost" 
              size="icon" 
              className="shrink-0 h-10 w-10 mb-[1px] text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              onClick={toggleRecording}
              disabled={loading}
              title="Falar por áudio com a NORA"
            >
              <Mic className="h-5 w-5" />
            </Button>
          ) : (
            <Button 
              onClick={() => handleSend(input)} 
              disabled={loading} 
              size="icon" 
              className="shrink-0 h-10 w-10 mb-[1px] shadow-sm"
              title="Enviar mensagem"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
