
'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/firebase/auth/use-user';
import { X, Bot, Trash2, Loader2, Send, Volume2, VolumeX, Mic, Paperclip } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

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
            
            // Call our new Vision API
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

  const toggleRecording = async () => {
    if (isRecording) {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
        return;
    }

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
            const userMsg: Message = { role: 'user', content: '[Processando áudio...]', timestamp: new Date() };
            setMessages(prev => [...prev, userMsg]);

            const formData = new FormData();
            formData.append('file', audioBlob, 'voice.webm');

            try {
                const response = await fetch('/api/media/transcribe', {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();
                
                if (data.text) {
                    setMessages(prev => {
                        const newMsgs = [...prev];
                        newMsgs[newMsgs.length - 1].content = `🎙️ ${data.text}`;
                        return newMsgs;
                    });
                    handleSendInternal(`[Áudio do usuário transcrito]: "${data.text}"`);
                } else {
                    toast({ title: 'Erro', description: 'Falha ao transcrever áudio.', variant: 'destructive' });
                    setLoading(false);
                }
            } catch (err) {
                console.error("Erro no áudio:", err);
                setLoading(false);
            }
        };

        mediaRecorder.start();
        setIsRecording(true);
    } catch (err) {
        toast({ title: 'Permissão negada', description: 'Libere o microfone no navegador.', variant: 'destructive' });
    }
  };

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
    
    setInput('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
    const userMsg: Message = { role: 'user', content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    await handleSendInternal(text);
  }, [loading, userProfile, company, messages, router, pathname]);



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
    <div className={cn(
      "fixed top-4 bottom-4 right-4 left-4 sm:left-auto sm:w-[500px] bg-background rounded-xl shadow-2xl border border-border flex flex-col z-50 overflow-hidden transition-all duration-300",
      !isOpen && "translate-y-[120%] opacity-0 pointer-events-none"
    )}>
      <div className="bg-primary text-primary-foreground p-4 shrink-0">
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
            placeholder={isRecording ? "Gravando áudio..." : "Digite sua mensagem..."} 
            className={cn(
                "flex-1 min-h-[40px] max-h-32 border border-input rounded-xl px-3.5 py-2.5 text-sm bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all resize-none overflow-y-auto leading-relaxed shadow-sm",
                isRecording && "bg-red-50 text-red-600 placeholder:text-red-500 animate-pulse border-red-200"
            )} 
            disabled={loading || isRecording} 
          />

          {!input.trim() ? (
            <Button 
              variant={isRecording ? "destructive" : "ghost"} 
              size="icon" 
              className={cn("shrink-0 h-10 w-10 mb-[1px]", isRecording ? "animate-pulse" : "text-muted-foreground")}
              onClick={toggleRecording}
              disabled={loading}
            >
              <Mic className="h-5 w-5" />
            </Button>
          ) : (
            <Button onClick={() => handleSend(input)} disabled={loading} size="icon" className="shrink-0 h-10 w-10 mb-[1px]">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
