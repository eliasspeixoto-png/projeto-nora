
"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calculator, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"


export default function CalculadoraPage() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState('');
  const router = useRouter();

  const handleButtonClick = (value: string) => {
    if (value === '=') {
      try {
        // Using eval is generally unsafe, but for a simple calculator it's a quick solution.
        // A more robust solution would involve parsing the expression.
        const evalResult = eval(input.replace(/%/g, '/100'));
        setResult(String(evalResult));
      } catch (error) {
        setResult('Erro');
      }
    } else if (value === 'C') {
      setInput('');
      setResult('');
    } else if (value === 'DEL') {
        setInput(input.slice(0, -1));
    } else {
      setInput(input + value);
    }
  };

  const buttons = [
    'C', 'DEL', '%', '/',
    '7', '8', '9', '*',
    '4', '5', '6', '-',
    '1', '2', '3', '+',
    '0', '.', '=',
  ];

  return (
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Calculator />
              Calculadora
            </CardTitle>
             <DialogTitle className="sr-only">Calculadora</DialogTitle>
            <DialogClose asChild>
                <Button variant="ghost" size="icon">
                  <X className="h-5 w-5" />
                  <span className="sr-only">Fechar</span>
                </Button>
            </DialogClose>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-muted rounded-lg p-4 mb-4 text-right">
            <div className="text-muted-foreground text-sm h-6">{input || '0'}</div>
            <div className="text-3xl font-semibold">{result || (input ? '' : '0')}</div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {buttons.map((btn) => (
              <Button
                key={btn}
                variant={
                    btn === '=' ? 'default' : 
                    ['C', 'DEL', '%', '/', '*', '-', '+'].includes(btn) ? 'secondary' 
                    : 'outline'
                }
                className={`text-xl font-semibold h-16 ${btn === '0' ? 'col-span-2' : ''}`}
                onClick={() => handleButtonClick(btn)}
              >
                {btn}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
  );
}
