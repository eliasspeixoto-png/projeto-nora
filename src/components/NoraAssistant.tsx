
'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/firebase/auth/use-user';
import { X, Bot, Trash2, Loader2, Send, Volume2, VolumeX } from 'lucide-react';
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
  const inputRef = useRef<HTMLInputElement>(null);


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



  const handleSend = useCallback(async (messageText: string) => {
    const text = messageText.trim();
    if (!text || loading || !userProfile) return;
    
    setInput('');
    const userMsg: Message = { role: 'user', content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const response = await fetch('/api/xcot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            messages: [...messages, userMsg].map(({ role, content }) => ({ role, content })),
            userContext: {
                uid: userProfile.uid,
                companyId: userProfile.companyId || '',
                companyName: company?.name || 'empresa',
                role: userProfile.role,
                displayName: userProfile.displayName,
                clientId: userProfile.clientId,
                currentPath: pathname
            }
        }),
      });

      const data = await response.json();
      
      if (data.actions && Array.isArray(data.actions)) {
          console.log('[NORA] Actions received:', data.actions);
          
          // Processar cada ação sequencialmente
          data.actions.forEach((action: any, index: number) => {
              const delay = index * 600; // 600ms entre cada ação
              
              setTimeout(() => {
                  console.log(`[NORA] Processing action (${index}):`, action);
                  
                  // Verificar se precisamos navegar para a página correta antes de disparar eventos de 'fence'
                  const isFenceAction = action.type.includes('fence');
                  const targetPath = '/orcamentos/cerca-eletrica';
                  
                  if (isFenceAction) {
                      const cleanCurrentPath = window.location.pathname.replace(/\/$/, "");
                      const cleanTargetPath = targetPath.replace(/\/$/, "");
                      
                      if (cleanCurrentPath !== cleanTargetPath) {
                          console.log('[NORA] Navigating to fence page...');
                          const navUrl = `${targetPath}?noraTrigger=${action.type}&noraData=${encodeURIComponent(JSON.stringify(action.data || {}))}`;
                          router.push(navUrl);
                          return; 
                      }
                  }

                  // Disparar evento genérico
                  window.dispatchEvent(new CustomEvent('nora-action', { detail: action }));
                  
                  // Disparar eventos específicos
                  if (action.type === 'fill_fence_form') {
                      window.dispatchEvent(new CustomEvent('nora-fill-fence-form', { detail: action.data }));
                  }
                  if (action.type === 'save_fence_quote') {
                      console.log('[NORA] Triggering save via NORA action');
                      window.dispatchEvent(new CustomEvent('nora-save-fence-quote'));
                  }
              }, delay);
          });
      }

      const assistantMsg: Message = {
        role: 'assistant',
        content: data.response || data.error || "Lamento, ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.",
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Ops, conexão instável. Tenta de novo? 😊`, timestamp: new Date() }]);
    } finally {
      setLoading(false);
      // Dar foco novamente após enviar
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
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
          <Input 
            ref={inputRef as any}
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { 
                if (e.key === 'Enter') { 
                    e.preventDefault();
                    // Usar o valor atual do elemento para garantir que pegamos a correção síncrona
                    handleSend(e.currentTarget.value); 
                } 
            }} 
            suggestions={productSuggestions}
            placeholder="Digite sua dúvida..." 
            className="flex-1 h-10 border border-input rounded-lg px-4 py-2.5 text-sm bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all" 
            disabled={loading} 
          />
          <Button onClick={() => handleSend(input)} disabled={loading || !input.trim()} size="icon" className="shrink-0 h-10 w-10 mb-[1px]">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
