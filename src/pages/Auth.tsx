import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert } from "lucide-react";

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 60;

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  const [lockCountdown, setLockCountdown] = useState(0);
  const attemptsRef = useRef(0);
  const lockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const startLockout = () => {
    setLocked(true);
    setLockCountdown(LOCKOUT_SECONDS);
    lockTimerRef.current = setInterval(() => {
      setLockCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(lockTimerRef.current!);
          lockTimerRef.current = null;
          setLocked(false);
          attemptsRef.current = 0;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (locked) return;
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          attemptsRef.current += 1;
          if (attemptsRef.current >= MAX_ATTEMPTS) {
            startLockout();
            toast({
              title: "Conta bloqueada temporariamente",
              description: `Muitas tentativas. Aguarde ${LOCKOUT_SECONDS}s.`,
              variant: "destructive",
            });
            setLoading(false);
            return;
          }
          throw error;
        }
        attemptsRef.current = 0;
        navigate("/dashboard");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast({
          title: "Conta criada!",
          description: "Verifique seu e-mail para confirmar o cadastro.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">🥫 PantryFlow</h1>
          <p className="text-muted-foreground mt-2">Controle inteligente de dispensa</p>
        </div>

        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            {isLogin ? "Entrar" : "Criar conta"}
          </h2>

          {locked && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-destructive/10 text-destructive text-sm">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>Bloqueado por {lockCountdown}s — muitas tentativas.</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                disabled={locked}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                disabled={locked}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading || locked}>
              {loading ? "Carregando..." : isLogin ? "Entrar" : "Cadastrar"}
            </Button>

            {isLogin && attemptsRef.current > 0 && !locked && (
              <p className="text-xs text-muted-foreground text-center">
                {MAX_ATTEMPTS - attemptsRef.current} tentativa(s) restante(s)
              </p>
            )}
          </form>

          <p className="text-center text-sm text-muted-foreground mt-4">
            {isLogin ? "Não tem conta?" : "Já tem conta?"}{" "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary font-medium hover:underline"
            >
              {isLogin ? "Cadastre-se" : "Faça login"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
