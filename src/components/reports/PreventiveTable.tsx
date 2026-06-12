// src/components/reports/PreventiveTable.tsx
import React from 'react';

export interface PreventiveItem {
  id: string;
  clientName: string;
  date: string; // ISO string
  frequency: '3m' | '6m' | '12m';
  status: string;
}

interface Props {
  data: PreventiveItem[];
}

export default function PreventiveTable({ data }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-2 text-left">Cliente</th>
            <th className="px-4 py-2 text-left">Data Prevista</th>
            <th className="px-4 py-2 text-left">Frequência</th>
            <th className="px-4 py-2 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map(item => (
            <tr key={item.id} className="border-t">
              <td className="px-4 py-2">{item.clientName}</td>
              <td className="px-4 py-2">{new Date(item.date).toLocaleDateString('pt-BR')}</td>
              <td className="px-4 py-2">
                {item.frequency === '3m' && 'A cada 3 meses'}
                {item.frequency === '6m' && 'A cada 6 meses'}
                {item.frequency === '12m' && 'Anual'}
              </td>
              <td className="px-4 py-2">{item.status}</td>
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-2 text-center text-muted-foreground">
                Nenhuma manutenção preventiva encontrada.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
