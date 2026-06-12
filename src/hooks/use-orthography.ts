
import { useState, useRef, useCallback } from 'react';
import { correctWord } from '@/lib/orthography';

/**
 * Hook para lidar com a correção ortográfica inteligente em tempo real.
 * Permite "forçar" uma escrita manual se o usuário corrigir a auto-correção.
 */
export function useOrthography(
  initialValue: string = '',
  onChange?: (value: string) => void,
  disabled: boolean = false
) {
  const [value, setValue] = useState(initialValue);
  const ignoredWords = useRef<Set<string>>(new Set());
  const lastCorrection = useRef<{ original: string; corrected: string; pos: number } | null>(null);

  const handleValueChange = useCallback((newValue: string) => {
    setValue(newValue);
    if (onChange) onChange(newValue);
  }, [onChange]);

  const processText = useCallback((text: string, cursorPosition: number, isFinal: boolean = false) => {
    if (disabled) return text;

    // Lógica para detectar se o usuário desfez uma correção recente
    if (lastCorrection.current) {
        const { original, corrected, pos } = lastCorrection.current;
        // Se o texto mudou exatamente na posição da última correção e não é mais o valor corrigido
        if (text.includes(original) && !text.includes(corrected)) {
            ignoredWords.current.add(original.toLowerCase());
            lastCorrection.current = null;
            return text;
        }
    }

    // Dividir o texto em palavras e processar a última palavra (ou todas se for final)
    const words = text.split(/(\s+)/);
    let changed = false;

    const processedWords = words.map((w, index) => {
      // Só corrigimos palavras, não espaços
      if (!/^\w+$/.test(w)) return w;
      
      const lowerW = w.toLowerCase();
      if (ignoredWords.current.has(lowerW)) return w;

      const corrected = correctWord(w);
      if (corrected !== w) {
        // Só corrigimos se não for a palavra que o usuário está digitando no momento
        // (a menos que ele tenha apertado espaço ou seja o processamento final)
        const isLastWord = index === words.length - 1;
        if (!isLastWord || isFinal) {
            changed = true;
            lastCorrection.current = { original: w, corrected, pos: cursorPosition };
            return corrected;
        }
      }
      return w;
    });

    return changed ? processedWords.join('') : text;
  }, [disabled]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (disabled) return;

    // Se for espaço ou enter, processamos a correção
    if (e.key === ' ' || e.key === 'Enter') {
      const target = e.target as HTMLInputElement;
      const start = target.selectionStart || 0;
      const currentValue = target.value;
      
      const newValue = processText(currentValue, start, true);
      if (newValue !== currentValue) {
        handleValueChange(newValue);
        // Nota: O React lidará com a atualização do valor antes do evento de teclado ser finalizado
      }
    }
  }, [disabled, handleValueChange, processText]);

  const onBlur = useCallback((e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (disabled) return;
    
    const currentValue = e.target.value;
    const newValue = processText(currentValue, currentValue.length, true);
    
    if (newValue !== currentValue) {
      handleValueChange(newValue);
    }
  }, [disabled, handleValueChange, processText]);

  return {
    onKeyDown,
    onBlur,
    setValue: handleValueChange,
    ignoredWords
  };
}
