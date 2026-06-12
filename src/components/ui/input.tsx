import * as React from "react"
import { cn } from "@/lib/utils"
import { correctFullText, commonSuggestions } from "@/lib/orthography"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  disableCorrection?: boolean;
  suggestions?: string[];
  enableAutocomplete?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onBlur, onKeyDown, onChange, disableCorrection = true, suggestions, enableAutocomplete = false, autoComplete = "off", ...props }, ref) => {
    // Buscar se o campo é uma busca (por tipo ou por nome/placeholder)
    const isSearchField = type === 'search' || 
                         props.name?.toLowerCase().includes('search') || 
                         props.placeholder?.toLowerCase().includes('buscar') || 
                         props.placeholder?.toLowerCase().includes('pesquisar') ||
                         props.name?.toLowerCase().includes('busca');

    // Se for um campo de busca, desativamos a correção automática por padrão
    const isCorrectionDisabled = disableCorrection || isSearchField;

    // ID único para o datalist
    const generatedId = React.useId();
    const datalistId = `suggestions-${generatedId}`;
    
    // Lista de palavras que o usuário "forçou" a escrita original para não corrigir novamente
    const ignoredWords = React.useRef<Set<string>>(new Set());
    const lastValueRef = React.useRef<string>("");
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    // Mesclar refs
    React.useImperativeHandle(ref, () => inputRef.current!);

    const applyCorrection = (currentValue: string) => {
      if (!currentValue || isCorrectionDisabled) return currentValue;

      // Chama o corretor global apenas uma vez no texto completo
      const newValue = correctFullText(currentValue);

      if (newValue !== currentValue && onChange) {
        // Atualizar o valor do elemento DOM real imediatamente para sincronismo
        if (inputRef.current) {
            inputRef.current.value = newValue;
        }

        // Criar um evento sintético para o onChange
        const event = {
          target: { ...inputRef.current, value: newValue, name: props.name },
          currentTarget: { ...inputRef.current, value: newValue },
          type: 'change'
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        
        onChange(event);
        lastValueRef.current = newValue;
        return newValue;
      }
      return currentValue;
    };


    const applyAiCorrection = async (currentValue: string) => {
      if (!currentValue || currentValue.length < 5 || isCorrectionDisabled) return;
      
      try {
        const response = await fetch('/api/fix-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: currentValue }),
        });
        
        if (response.ok) {
          const data = await response.json();
          const fixedText = data.fixedText || currentValue;
          
          // Se o valor do input já mudou significativamente ou está vazio (foi enviado), ignoramos
          if (!inputRef.current?.value) return;

          if (fixedText !== currentValue && onChange) {
            const event = {
              target: { ...inputRef.current, value: fixedText, name: props.name },
              currentTarget: { ...inputRef.current, value: fixedText },
              type: 'change'
            } as unknown as React.ChangeEvent<HTMLInputElement>;
            
            onChange(event);
            lastValueRef.current = fixedText;
          }
        }
      } catch (error) {
        console.error('Erro na correção IA:', error);
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (!disableCorrection && type !== 'password' && type !== 'email' && type !== 'url') {
        const locallyCorrected = applyCorrection(val);
        // Após a correção local rápida, tentamos a correção profunda via IA
        applyAiCorrection(locallyCorrected || val);
      }
      if (onBlur) onBlur(e);
    };


    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!disableCorrection) {
        if (e.key === ' ') {
            const target = e.target as HTMLInputElement;
            setTimeout(() => {
                applyCorrection(target.value);
            }, 0);
        } else if (e.key === 'Enter') {
            const target = e.target as HTMLInputElement;
            // No Enter, corrigimos de forma SÍNCRONA antes do evento de envio
            applyCorrection(target.value);
        }
      }
      if (onKeyDown) onKeyDown(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        const lastValue = lastValueRef.current;
        
        // Se o valor diminuiu (ex: backspace) ou mudou, e o valor anterior era uma correção
        // tentamos detectar se o usuário está "desfazendo" a correção
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

    const currentSuggestions = suggestions || (enableAutocomplete ? commonSuggestions : []);

    return (
      <>
        <input
          type={type}
          autoComplete={autoComplete}
          className={cn(
            "flex h-12 w-full rounded-2xl border border-primary/20 bg-background/50 hover:bg-background/80 transition-all px-4 py-2 text-sm font-semibold text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-semibold placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onChange={handleChange}
          ref={inputRef}
          list={currentSuggestions.length > 0 ? datalistId : undefined}
          {...props}
        />
        {currentSuggestions.length > 0 && (
          <datalist id={datalistId}>
            {currentSuggestions.map((suggestion, index) => (
              <option key={index} value={suggestion} />
            ))}
          </datalist>
        )}
      </>
    )
  }
)
Input.displayName = "Input"

export { Input }


