"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "../../../components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog"
import { Input } from "../../../components/ui/input"
import { Label } from "../../../components/ui/label"
import { useToast } from "../../../hooks/use-toast"
import { Loader2, Mail, Lock, Eye, EyeOff, ArrowLeft, Download, Smartphone } from "lucide-react"
import { useAuth } from "../../../firebase/auth/use-user"
import { Checkbox } from "../../../components/ui/checkbox"
import Image from "next/image";
import { getUserByEmail, getCompany } from "../../../lib/firebase/firestore"
import { AnimatePresence, motion } from "framer-motion"
import { ProtectedRoute } from "../../../components/ProtectedRoute"
import { usePWAInstall } from "../../../hooks/use-pwa-install"

type LoginStep = "email" | "password";
const DEFAULT_LOGO = "https://firebasestorage.googleapis.com/v0/b/studio-2629657699-721b1.firebasestorage.app/o/logos%2FNORA%203%20transparente.png?alt=media&token=2d5b0b94-7dd8-47e2-9d6b-32779ad80b84";

export default function LoginPage() {
  const [step, setStep] = useState<LoginStep>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [companyLogo, setCompanyLogo] = useState<string | null>(DEFAULT_LOGO);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const { canInstall, installPrompt } = usePWAInstall();

  const router = useRouter();
  const { toast } = useToast();
  const { signIn, firebase } = useAuth();

  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const [showPassword, setShowPassword] = useState(false);

  const updateLogoByEmail = useCallback(async (emailStr: string) => {
    const emailClean = emailStr?.trim().toLowerCase();
    if (!emailClean || !emailClean.includes('@') || !firebase) {
      setCompanyLogo(DEFAULT_LOGO);
      return;
    }

    try {
      const { db } = firebase;
      const userProfile = await getUserByEmail(db, emailClean);
      if (userProfile) {
        if (userProfile.logoUrl) {
          setCompanyLogo(userProfile.logoUrl);
          setCompanyName(userProfile.displayName || null);
        } else if (userProfile.companyId) {
          const company = await getCompany(db, userProfile.companyId);
          setCompanyLogo(company?.logoUrl || DEFAULT_LOGO);
          setCompanyName(company?.name || null);
        } else {
          setCompanyLogo(DEFAULT_LOGO);
          setCompanyName(null);
        }
      } else {
        setCompanyLogo(DEFAULT_LOGO);
        setCompanyName(null);
      }
    } catch (error) {
      console.warn("Logo fetch failed", error);
      setCompanyLogo(DEFAULT_LOGO);
      setCompanyName(null);
    }
  }, [firebase]);

  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
      // Busca o logo imediatamente se houver e-mail salvo
      updateLogoByEmail(savedEmail);
    }
  }, [updateLogoByEmail]);

  // Busca reativa com debounce (600ms)
  useEffect(() => {
    const emailClean = email.trim();
    // Só dispara a busca se tiver o formato mínimo de um e-mail (algo@algo.algo)
    if (step === 'email' && emailClean.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      const timer = setTimeout(() => {
        updateLogoByEmail(emailClean);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [email, step, updateLogoByEmail]);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (canInstall && !isStandalone) {
      // Oferece a instalação assim que possível
      setShowInstallDialog(true);
    }
  }, [canInstall]);


  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebase) return;
    setIsLoading(true);

    try {
      // Garante que o logo mais atual seja buscado antes de avançar, 
      // caso o debounce ainda não tenha terminado
      await updateLogoByEmail(email);
    } catch (error) {
      console.warn("Error in final logo check", error);
    } finally {
      setStep("password");
      setTimeout(() => passwordInputRef.current?.focus(), 100);
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await signIn(email, password);

      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }

      toast({
        title: "Login bem-sucedido!",
        description: "Você será redirecionado...",
      });

    } catch (error: any) {
      let description = "Ocorreu um erro desconhecido. Tente novamente.";

      switch (error.code) {
        case 'auth/user-not-found':
          description = "Nenhum usuário encontrado com este e-mail.";
          break;
        case 'auth/wrong-password':
          description = "Senha incorreta. Por favor, tente novamente.";
          break;
        case 'auth/invalid-credential':
        case 'auth/invalid-login-credentials':
          description = "Credenciais inválidas. Verifique seu e-mail e senha.";
          break;
        case 'auth/too-many-requests':
          description = "Acesso temporariamente desabilitado devido a muitas tentativas de login. Tente novamente mais tarde.";
          break;
        case 'auth/invalid-email':
          description = "O formato do e-mail é inválido.";
          break;
        default:
          description = error.message || "Ocorreu um erro desconhecido.";
      }

      toast({
        variant: "destructive",
        title: "Falha no Login",
        description: description,
      })
    } finally {
      setIsLoading(false);
    }
  };

  const backToEmailStep = () => {
    setStep('email');
    setPassword('');
    setTimeout(() => emailInputRef.current?.focus(), 100);
  };

  const handleInstall = () => {
    if (installPrompt) {
      installPrompt();
    }
    setShowInstallDialog(false);
  };

  const handleSkipInstall = () => {
    setShowInstallDialog(false);
  };


  return (
    <ProtectedRoute requireAuth={false}>
      <Card className="max-w-[400px] w-full border-none bg-background/40 backdrop-blur-3xl rounded-[2.5rem] shadow-premium overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <CardHeader className="pt-10 pb-6 text-center space-y-4">
          <motion.div
            key={companyLogo}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex justify-center mb-4"
          >
            <div className="relative h-16 w-24">
              <Image src={companyLogo || DEFAULT_LOGO} alt="NORA Logo" fill style={{ objectFit: 'contain' }} sizes="96px" />
            </div>
          </motion.div>
          <motion.div
            key={companyName}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            <CardTitle className="font-semibold tracking-tighter text-foreground text-xl">
              {companyName ? `Bem-vindo à ${companyName}` : 'Bem-vindo ao NORA'}
            </CardTitle>
          </motion.div>
          <CardDescription className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary/40">
            {step === 'email' ? 'Identificação Necessária' : `Autenticação para ${email}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AnimatePresence mode="wait">
            {step === "email" && (
              <motion.form
                key="email-step"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                transition={{ duration: 0.3 }}
                onSubmit={handleEmailSubmit}
                className="grid gap-4"
              >
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/30 group-focus-within:text-primary transition-colors" />
                    <Input
                      id="email"
                      ref={emailInputRef}
                      type="email"
                      placeholder="seu@email.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      className="h-14 pl-12 rounded-2xl bg-background/50 border-border/40 focus:bg-background focus:ring-primary/20 font-semibold transition-all"
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="remember-me-email" checked={rememberMe} onCheckedChange={(checked) => setRememberMe(checked as boolean)} />
                  <label htmlFor="remember-me-email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Lembrar meu email
                  </label>
                </div>
                <Button
                  type="submit"
                  className="h-14 w-full rounded-2xl font-semibold tracking-tight shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all bg-primary"
                  disabled={isLoading || !email}
                >
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Continuar >>>'}
                </Button>
                <div className="mt-2 text-center text-sm">
                  <Link
                    href="/forgot-password"
                    className="inline-block text-sm underline"
                  >
                    Esqueci minha senha
                  </Link>
                </div>
              </motion.form>
            )}

            {step === "password" && (
              <motion.form
                key="password-step"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.3 }}
                onSubmit={handlePasswordSubmit}
                className="grid gap-4"
              >
                <div className="grid gap-2">
                  <div className="flex items-center">
                    <Label htmlFor="password">Senha</Label>
                    <Link
                      href="/forgot-password"
                      className="ml-auto inline-block text-sm underline"
                    >
                      Esqueci minha senha
                    </Link>
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/30 group-focus-within:text-primary transition-colors" />
                    <Input
                      id="password"
                      ref={passwordInputRef}
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Sua senha secreta"
                      disabled={isLoading}
                      autoComplete="current-password"
                      className="h-14 pl-12 pr-12 rounded-2xl bg-background/50 border-border/40 focus:bg-background focus:ring-primary/20 font-semibold transition-all"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 text-muted-foreground hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="h-14 w-full rounded-2xl font-semibold tracking-tight shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all bg-primary"
                  disabled={isLoading || !password}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Autenticando...
                    </>
                  ) : 'Entrar no Sistema'}
                </Button>
                <div className="text-center text-sm">
                  <Button variant="link" onClick={backToEmailStep} className="text-muted-foreground">
                    <ArrowLeft className="mr-2 h-3 w-3" />
                    Voltar para o e-mail
                  </Button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
          <div className="mt-8 pt-6 border-t border-border/40 text-center text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest space-y-4">
            <div className="flex items-center justify-center gap-4">
              <Link href="/signup" className="hover:text-primary transition-colors">
                Criar Conta
              </Link>
              <span className="opacity-20 text-foreground">|</span>
              <Link href="/planos" className="hover:text-primary transition-colors">
                Nossos Planos
              </Link>
            </div>
            <p className="text-[9px] opacity-40 font-semibold">NORA © 2018</p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showInstallDialog} onOpenChange={setShowInstallDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone /> Instalar o Aplicativo NORA?
            </DialogTitle>
            <DialogDescription>
              Instale o aplicativo em seu dispositivo para uma experiência mais rápida e integrada, com acesso offline e notificações.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleSkipInstall}>Agora não</Button>
            <Button onClick={handleInstall}>
              <Download className="mr-2 h-4 w-4" />
              Instalar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  )
}
