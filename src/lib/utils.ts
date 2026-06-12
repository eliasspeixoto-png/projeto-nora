import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function deg2rad(deg: number) {
    return deg * (Math.PI / 180);
}

export function getDistanceInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

/**
 * Constante central do fuso horário da plataforma.
 */
export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

/**
 * Retorna um objeto Date ajustado para o fuso horário de Brasília.
 */
export function getBrasiliaDate(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: DEFAULT_TIMEZONE }));
}

/**
 * Converte qualquer data (Date, string ISO, timestamp) para o fuso de Brasília.
 */
export function toBrasiliaDate(dateInput: Date | string | number): Date {
  const date = new Date(dateInput);
  return new Date(date.toLocaleString("en-US", { timeZone: DEFAULT_TIMEZONE }));
}

/**
 * Formata uma data forçando o fuso horário de Brasília.
 * Utiliza Intl.DateTimeFormat para garantir precisão sem dependências extras pesadas.
 */
export function formatBrasilia(dateInput: Date | string | number, formatStr: string = "HH:mm:ss"): string {
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return "--:--:--";

    // Mapeamento simples para os formatos mais comuns usados no app
    const parts = new Intl.DateTimeFormat("pt-BR", {
      timeZone: DEFAULT_TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour12: false,
    }).formatToParts(date);

    const getPart = (type: string) => parts.find(p => p.type === type)?.value || "";

    if (formatStr === "HH:mm:ss") return `${getPart("hour")}:${getPart("minute")}:${getPart("second")}`;
    if (formatStr === "HH:mm") return `${getPart("hour")}:${getPart("minute")}`;
    if (formatStr === "dd/MM/yyyy") return `${getPart("day")}/${getPart("month")}/${getPart("year")}`;
    if (formatStr === "dd/MM/yyyy HH:mm:ss") return `${getPart("day")}/${getPart("month")}/${getPart("year")} ${getPart("hour")}:${getPart("minute")}:${getPart("second")}`;
    
    // Fallback padrão se não bater com os templates
    return date.toLocaleString("pt-BR", { timeZone: DEFAULT_TIMEZONE });
  } catch (e) {
    return "--:--:--";
  }
}

/**
 * Retorna a data atual no formato YYYY-MM-DD ajustada para Brasília.
 */
export function getTodayBrasiliaISO(): string {
  const date = getBrasiliaDate();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Remove acentos e caracteres especiais, converte para minúsculas e remove espaços extras.
 */
export function normalizeString(str: string | undefined | null): string {
  if (!str) return "";
  return str
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Formata o nome para exibição curta (Primeiro + Último Nome).
 */
export function formatDisplayName(name: string | undefined): string {
  if (!name) return 'Sem nome';
  const parts = name.trim().split(/\s+/);
  if (parts.length > 1) {
    return `${parts[0]} ${parts[parts.length - 1]}`;
  }
  return name;
}

/**
 * Formata uma string para Title Case (Primeira letra de cada palavra em maiúscula).
 * Mantém partículas de ligação em minúsculas.
 */
export function formatTitleCase(str: string | undefined | null): string {
  if (!str) return "";
  const exceptions = ["de", "do", "da", "dos", "das", "e", "com", "em"];
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => {
      if (index > 0 && exceptions.includes(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}
