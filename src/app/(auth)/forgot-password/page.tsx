
"use client"

import { useState } from "react"
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
import { Input } from "../../../components/ui/input"
import { Label } from "../../../components/ui/label"
import { useToast } from "../../../hooks/use-toast"
import { Loader2, Shield, ArrowLeft } from "lucide-react"
import { useAuth } from "../../../firebase/auth/use-user"
import Image from "next/image";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast()
  const { sendPasswordReset } = useAuth();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true);

    try {
        await sendPasswordReset(email);
        toast({
            title: "Email Enviado!",
            description: "Verifique sua caixa de entrada para o link de redefinição de senha.",
        });
    } catch (error: any) {
        let description = "Ocorreu um erro desconhecido. Tente novamente.";
        if(error.code === 'auth/user-not-found') {
            description = "Nenhuma conta encontrada com este endereço de e-mail.";
        }
        
        toast({
            variant: "destructive",
            title: "Falha ao Enviar",
            description: description,
        })
    } finally {
        setIsLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="mx-auto max-w-sm w-full shadow-lg">
        <CardHeader>
           <div className="flex justify-center mb-4">
            <div className="relative size-16">
              <Image src="https://firebasestorage.googleapis.com/v0/b/studio-2629657699-721b1.firebasestorage.app/o/logos%2FNORA%203%20transparente.png?alt=media&token=2d5b0b94-7dd8-47e2-9d6b-32779ad80b84" alt="NORA Logo" fill style={{objectFit:'contain'}} sizes="64px"/>
            </div>
          </div>
          <CardTitle className="text-center font-headline text-xl">
            Esqueceu sua Senha?
          </CardTitle>
          <CardDescription className="text-center">
            Sem problemas! Digite seu email abaixo para receber um link de redefinição.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResetPassword} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Digite seu email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : 'Enviar Link de Redefinição'}
            </Button>
          </form>
           <div className="mt-4 text-center text-sm">
            <Link href="/login" className="underline flex items-center justify-center gap-1">
              <ArrowLeft className="h-3 w-3"/> Voltar para o Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
