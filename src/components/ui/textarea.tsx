
import * as React from 'react';
import {cn} from '@/lib/utils';
import { correctFullText } from "@/lib/orthography"

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  disableCorrection?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({className, onBlur, onKeyDown, onChange, disableCorrection, ...props}, ref) => {
    const ignoredWords = React.useRef<Set<string>>(new Set());
    const lastValueRef = React.useRef<string>("");
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

    // Mesclar refs
    React.useImperativeHandle(ref, () => textareaRef.current!);

    const applyCorrection = (currentValue: string) => {
      if (!currentValue || disableCorrection) return currentValue;

      const newValue = correctFullText(currentValue);

      if (newValue !== currentValue && onChange) {
        const event = {
          target: { ...textareaRef.current, value: newValue, name: props.name },
          currentTarget: { ...textareaRef.current, value: newValue },
          type: 'change'
        } as unknown as React.ChangeEvent<HTMLTextAreaElement>;
        
        onChange(event);
        lastValueRef.current = newValue;
        return newValue;
      }
      return currentValue;
    };


    const applyAiCorrection = async (currentValue: string) => {
      if (!currentValue || currentValue.length < 5 || disableCorrection) return;
      
      try {
        const response = await fetch('/api/fix-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: currentValue }),
        });
        
        if (response.ok) {
          const data = await response.json();
          const fixedText = data.fixedText || currentValue;
          
          if (fixedText !== currentValue && onChange) {
            const event = {
              target: { ...textareaRef.current, value: fixedText, name: props.name },
              currentTarget: { ...textareaRef.current, value: fixedText },
              type: 'change'
            } as unknown as React.ChangeEvent<HTMLTextAreaElement>;
            
            onChange(event);
            lastValueRef.current = fixedText;
          }
        }
      } catch (error) {
        console.error('Erro na correção IA:', error);
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      if (!disableCorrection) {
        const locallyCorrected = applyCorrection(val);
        applyAiCorrection(locallyCorrected || val);
      }
      if (onBlur) onBlur(e);
    };


    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!disableCorrection && (e.key === ' ' || e.key === 'Enter')) {
        const target = e.target as HTMLTextAreaElement;
        setTimeout(() => {
            applyCorrection(target.value);
        }, 0);
      }
      if (onKeyDown) onKeyDown(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        const lastValue = lastValueRef.current;
        
        if (lastValue && newValue.length < lastValue.length) {
            const wordsLast = lastValue.split(/(\s+)/);
            const wordsNew = newValue.split(/(\s+)/);
            
            wordsLast.forEach((w, i) => {
                if (w !== wordsNew[i] && /^\w+$/.test(w)) {
                    ignoredWords.current.add(wordsNew[i]?.toLowerCase() || "");
                    ignoredWords.current.add(w.toLowerCase());
                }
            });
        }

        lastValueRef.current = newValue;
        if (onChange) onChange(e);
    };

    return (
      <textarea
        spellCheck={true}
        className={cn(
          'flex min-h-[80px] w-full rounded-2xl border border-primary/20 bg-background/50 hover:bg-background/80 transition-all px-4 py-3 text-sm font-semibold ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
        ref={textareaRef}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';

export {Textarea};

