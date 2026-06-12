export interface ItemCalculado {
  nome: string;
  quantidade: number;
  valor_unitario: number;
  subtotal: number;
}

export interface ItensCalculados {
  items: ItemCalculado[];
  total: number;
}
