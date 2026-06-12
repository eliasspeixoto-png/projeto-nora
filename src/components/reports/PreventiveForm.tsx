import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectItem } from '@/components/ui/select';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';

export default function PreventiveForm({ onClose }: { onClose?: () => void }) {
  const router = useRouter();
  const [clientId, setClientId] = useState('');
  const [date, setDate] = useState('');
  const [frequency, setFrequency] = useState<'3m' | '6m' | '12m'>('3m');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!clientId || !date) {
      toast({ variant: 'destructive', description: 'Preencha todos os campos.' });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/preventive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, date, frequency }),
      });
      if (!res.ok) throw new Error('Erro ao salvar');
      toast({ description: 'Manutenção preventiva agendada!' });
      if (onClose) onClose();
      router.refresh();
    } catch (e) {
      toast({ variant: 'destructive', description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose?.()}> 
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Agendar Manutenção Preventiva</DialogTitle>
          <DialogDescription>Preencha os dados da manutenção.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Input placeholder="ID do cliente" value={clientId} onChange={(e) => setClientId(e.target.value)} />
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Select value={frequency} onValueChange={(v) => setFrequency(v as any)}>
            <SelectItem value="3m">A cada 3 meses</SelectItem>
            <SelectItem value="6m">A cada 6 meses</SelectItem>
            <SelectItem value="12m">A cada 12 meses</SelectItem>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose?.()} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>Agendar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
