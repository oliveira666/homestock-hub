import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ShoppingBasket } from "lucide-react";

interface Produto {
  id: string;
  nome: string;
  unidade: string;
}

const Dispensa = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [selectedProduto, setSelectedProduto] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("produtos")
      .select("id, nome, unidade")
      .order("nome")
      .then(({ data }) => setProdutos((data as Produto[]) || []));
  }, [user]);

  const selectedUnit = produtos.find((p) => p.id === selectedProduto)?.unidade || "";

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedProduto) return;

    const qty = Number(quantidade);
    if (qty <= 0) {
      toast({ title: "Erro", description: "Quantidade deve ser maior que zero.", variant: "destructive" });
      return;
    }

    setLoading(true);

    const { data: existing } = await supabase
      .from("dispensa_itens")
      .select("id, quantidade")
      .eq("produto_id", selectedProduto)
      .eq("usuario_id", user.id)
      .maybeSingle();

    let error;
    if (existing) {
      ({ error } = await supabase
        .from("dispensa_itens")
        .update({ quantidade: existing.quantidade + qty })
        .eq("id", existing.id));
    } else {
      ({ error } = await supabase.from("dispensa_itens").insert({
        usuario_id: user.id,
        produto_id: selectedProduto,
        quantidade: qty,
      }));
    }

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: existing ? "Quantidade atualizada!" : "Item adicionado!",
        description: existing
          ? `Quantidade somada: ${existing.quantidade} + ${qty}`
          : `${qty} ${selectedUnit} adicionados à dispensa.`,
      });
      setQuantidade("");
      setSelectedProduto("");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dispensa</h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Adicione itens à sua dispensa
        </p>
      </div>

      {/* Formulário */}
      <div className="bg-white shadow rounded-lg p-4 sm:p-6 max-w-lg w-full mx-auto">
        <h2 className="text-lg font-semibold text-foreground mb-4">Adicionar Item</h2>

        {produtos.length === 0 ? (
          <p className="text-muted-foreground text-sm sm:text-base text-center">
            Nenhum produto cadastrado. Cadastre um produto primeiro.
          </p>
        ) : (
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-1">
              <Label>Produto</Label>
              <Select value={selectedProduto} onValueChange={setSelectedProduto}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um produto" />
                </SelectTrigger>
                <SelectContent>
                  {produtos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="quantidade">
                Quantidade {selectedUnit && <span className="text-muted-foreground">({selectedUnit})</span>}
              </Label>
              <Input
                id="quantidade"
                type="number"
                min="0.01"
                step="0.01"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                placeholder="0"
                required
              />
            </div>

            <Button type="submit" disabled={loading || !selectedProduto} className="w-full flex items-center justify-center">
              <ShoppingBasket className="h-4 w-4 mr-2" />
              {loading ? "Adicionando..." : "Adicionar à Dispensa"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Dispensa;