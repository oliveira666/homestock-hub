import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

interface Produto {
  id: string;
  nome: string;
  unidade: string;
  estoque_minimo: number;
  created_at: string;
}

const Produtos = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [nome, setNome] = useState("");
  const [unidade, setUnidade] = useState<string>("unidade");
  const [estoqueMinimo, setEstoqueMinimo] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchProdutos = async () => {
    const { data } = await supabase
      .from("produtos")
      .select("*")
      .order("created_at", { ascending: false });
    setProdutos((data as Produto[]) || []);
  };

  useEffect(() => {
    if (user) fetchProdutos();
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    const { error } = await supabase.from("produtos").insert([{
      usuario_id: user.id,
      nome: nome.trim(),
      unidade: unidade as "kg" | "unidade",
      estoque_minimo: Number(estoqueMinimo) || 0,
    }]);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Produto criado!" });
      setNome("");
      setEstoqueMinimo("");
      fetchProdutos();
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("produtos").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      fetchProdutos();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Produtos</h1>
        <p className="text-sm text-muted-foreground">Cadastre e gerencie seus produtos</p>
      </div>

      <div className="glass-card p-4 sm:p-6">
        <h2 className="text-base font-semibold text-foreground mb-4">Novo Produto</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Arroz" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Unidade</Label>
              <Select value={unidade} onValueChange={setUnidade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="unidade">unidade</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="estoque">Estoque mínimo</Label>
              <Input id="estoque" type="number" min="0" value={estoqueMinimo} onChange={(e) => setEstoqueMinimo(e.target.value)} placeholder="0" />
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            {loading ? "Criando..." : "Criar Produto"}
          </Button>
        </form>
      </div>

      <div className="glass-card">
        <div className="p-4 sm:p-6 border-b border-border">
          <h2 className="font-semibold text-foreground text-sm sm:text-base">Seus Produtos</h2>
        </div>
        <div className="divide-y divide-border">
          {produtos.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Nenhum produto cadastrado.</div>
          ) : (
            produtos.map((p) => (
              <div key={p.id} className="p-3 sm:p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground text-sm">{p.nome}</p>
                  <p className="text-xs text-muted-foreground">{p.unidade} · Mínimo: {p.estoque_minimo}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(p.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Produtos;
