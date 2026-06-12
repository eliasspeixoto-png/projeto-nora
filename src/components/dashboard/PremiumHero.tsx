import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles, Calendar, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PremiumHeroProps {
  userName?: string;
}

export default function PremiumHero({ userName }: PremiumHeroProps) {
  const firstName = userName?.split(" ")[0] || "Usuário";
  const [today, setToday] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setToday(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const dateStr = format(today, "EEEE, dd 'de' MMMM", { locale: ptBR });
  const hour = today.getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div className="relative w-full mt-[5px] mb-[8px] rounded-xl overflow-hidden glass-premium noise-overlay min-h-[50px] sm:min-h-[65px] flex flex-col justify-center p-2 sm:px-8 group">
      {/* Dynamic Mesh Background Part 1 */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[80%] rounded-full bg-primary/20 blur-[120px] animate-mesh" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[70%] rounded-full bg-indigo-500/10 blur-[100px] animate-mesh" style={{ animationDelay: '-5s' }} />
      </div>
 
      {/* Content */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-xl sm:text-3xl font-headline italic tracking-tighter text-foreground leading-tight"
          >
            {greeting}, <span className="not-italic font-semibold text-primary">{firstName}</span>.
          </motion.h1>
          

        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-col items-end gap-2 pr-2"
        >
          <div className="flex items-center gap-3">
             <div className="flex flex-col items-end">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-primary/40 leading-none mb-1">Status Temporal</span>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-foreground/80 tracking-tighter">
                        <Calendar className="h-3 w-3 text-primary/60" />
                        {dateStr}
                    </div>
                    <div className="flex items-center gap-2 text-[18px] font-headline italic text-primary leading-none">
                        <Clock className="h-4 w-4 text-primary/40 not-italic" />
                        {format(today, "HH:mm")}
                    </div>
                </div>
             </div>
          </div>
        </motion.div>
      </div>

      {/* Decorative Prism Border */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
    </div>

  );
}
