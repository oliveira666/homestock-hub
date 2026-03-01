import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Minus, Plus, Upload, ShoppingBasket } from "lucide-react";

interface EstoqueItem {
  id: string;
  quantidade: number;
  updated_at: string;
  produto_id: string;
  produtos: {
    nome: string;
    unidade: string;
    estoque_minimo: number;
  } | null;
}

interface Produto {
  id: string;
  nome: string;
  unidade: string;
}

interface BulkLine {
  produto_id: string;
  quantidade: string;
}

const Estoque = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [itens, setItens] = useState<EstoqueItem[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [showBulk, setShowBulk] = useState(false);
  const [clearPrevious, setClearPrevious] = useState(false);
  const [bulkLines, setBulkLines] = useState<BulkLine[]>([{ produto_id: "", quantidade: "" }]);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Dispensa (add item) state
  const [selectedProduto, setSelectedProduto] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  const selectedUnit = produtos.find((p) => p.id === selectedProduto)?.unidade || "";

  const fetchItens = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("dispensa_itens")
      .select("id, quantidade, updated_at, produto_id, produtos(nome, unidade, estoque_minimo)")
      .order("updated_at", { ascending: false });
    setItens((data as any) || []);
  };

  const fetchProdutos = async () => {
    const { data } = await supabase.from("produtos").select("id, nome, unidade").order("nome");
    setProdutos((data as Produto[]) || []);
  };

  useEffect(() => {
    if (!user) return;
    fetchItens();
    fetchProdutos();
  }, [user]);

  // --- Add item (dispensa) ---
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedProduto) return;

    const qty = Number(quantidade);
    if (qty <= 0) {
      toast({ title: "Erro", description: "Quantidade deve ser maior que zero.", variant: "destructive" });
      return;
    }

    setAddLoading(true);

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
      fetchItens();
    }
    setAddLoading(false);
  };

  // --- Remove / decrease ---
  const handleRemove = async (id: string) => {
    const { error } = await supabase.from("dispensa_itens").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Item removido!" });
      fetchItens();
    }
  };

  const handleDecrease = async (item: EstoqueItem) => {
    const newQty = item.quantidade - 1;
    if (newQty <= 0) {
      await handleRemove(item.id);
      return;
    }
    const { error } = await supabase.from("dispensa_itens").update({ quantidade: newQty }).eq("id", item.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      fetchItens();
    }
  };

  // --- Bulk import ---
  const addBulkLine = () => setBulkLines([...bulkLines, { produto_id: "", quantidade: "" }]);

  const updateBulkLine = (index: number, field: keyof BulkLine, value: string) => {
    const updated = [...bulkLines];
    updated[index][field] = value;
    setBulkLines(updated);
  };

  const removeBulkLine = (index: number) => {
    if (bulkLines.length <= 1) return;
    setBulkLines(bulkLines.filter((_, i) => i !== index));
  };

  const handleBulkImport = async () => {
    if (!user) return;
    const validLines = bulkLines.filter((l) => l.produto_id && Number(l.quantidade) > 0);
    if (validLines.length === 0) {
      toast({ title: "Erro", description: "Adicione ao menos um item válido.", variant: "destructive" });
      return;
    }

    setBulkLoading(true);

    if (clearPrevious) {
      await supabase.from("dispensa_itens").delete().eq("usuario_id", user.id);
    }

    for (const line of validLines) {
      const qty = Number(line.quantidade);
      if (clearPrevious) {
        await supabase.from("dispensa_itens").insert({
          usuario_id: user.id,
          produto_id: line.produto_id,
          quantidade: qty,
        });
      } else {
        const { data: existing } = await supabase
          .from("dispensa_itens")
          .select("id, quantidade")
          .eq("produto_id", line.produto_id)
          .eq("usuario_id", user.id)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("dispensa_itens")
            .update({ quantidade: existing.quantidade + qty })
            .eq("id", existing.id);
        } else {
          await supabase.from("dispensa_itens").insert({
            usuario_id: user.id,
            produto_id: line.produto_id,
            quantidade: qty,
          });
        }
      }
    }

    toast({ title: "Importação concluída!", description: `${validLines.length} itens processados.` });
    setBulkLines([{ produto_id: "", quantidade: "" }]);
    setShowBulk(false);
    setBulkLoading(false);
    fetchItens();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Estoque</h1>
        <p className="text-sm text-muted-foreground">Gerencie os itens da sua dispensa</p>
      </div>

      {/* Add item form (formerly Dispensa page) */}
      <div className="glass-card p-4 sm:p-6">
        <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
          <ShoppingBasket className="h-4 w-4" />
          Adicionar Item
        </h2>

        {produtos.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum produto cadastrado. Cadastre um produto primeiro.</p>
        ) : (
          <form onSubmit={handleAdd} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Produto</Label>
              <Select value={selectedProduto} onValueChange={setSelectedProduto}>
                <SelectTrigger><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
                <SelectContent>
                  {produtos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-32 space-y-1">
              <Label className="text-xs text-muted-foreground">
                Qtd {selectedUnit && `(${selectedUnit})`}
              </Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                placeholder="0"
                required
              />
            </div>
            <Button type="submit" disabled={addLoading || !selectedProduto} className="shrink-0">
              <ShoppingBasket className="h-4 w-4 mr-2" />
              {addLoading ? "Adicionando..." : "Adicionar"}
            </Button>
          </form>
        )}
      </div>

      {/* Action bar */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setShowBulk(!showBulk)}>
          <Upload className="h-4 w-4 mr-2" />
          {showBulk ? "Fechar importação" : "Importação em lote"}
        </Button>
      </div>

      {/* Bulk import panel */}
      {showBulk && (
        <div className="glass-card p-4 sm:p-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold text-foreground">Importação em Lote</h2>
            <div className="flex items-center gap-2">
              <Switch checked={clearPrevious} onCheckedChange={setClearPrevious} id="clear" />
              <Label htmlFor="clear" className="text-sm text-muted-foreground">Limpar estoque anterior</Label>
            </div>
          </div>

          <div className="space-y-3">
            {bulkLines.map((line, i) => (
              <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1">
                  {i === 0 && <Label className="text-xs text-muted-foreground">Produto</Label>}
                  <Select value={line.produto_id} onValueChange={(v) => updateBulkLine(i, "produto_id", v)}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {produtos.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full sm:w-28 space-y-1">
                  {i === 0 && <Label className="text-xs text-muted-foreground">Qtd</Label>}
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={line.quantidade}
                    onChange={(e) => updateBulkLine(i, "quantidade", e.target.value)}
                    placeholder="0"
                  />
                </div>
                <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => removeBulkLine(i)} disabled={bulkLines.length <= 1}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button variant="outline" size="sm" onClick={addBulkLine}>
              <Plus className="h-4 w-4 mr-1" /> Mais um item
            </Button>
            <Button onClick={handleBulkImport} disabled={bulkLoading} size="sm">
              <Upload className="h-4 w-4 mr-2" />
              {bulkLoading ? "Importando..." : "Importar tudo"}
            </Button>
          </div>
        </div>
      )}

      {/* Stock list */}
      <div className="glass-card">
        <div className="p-4 sm:p-6 border-b border-border">
          <h2 className="font-semibold text-foreground">Itens em Estoque</h2>
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Produto</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Quantidade</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Atualizado</th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {itens.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum item no estoque.</td></tr>
              ) : (
                itens.map((item) => {
                  const isBaixo = item.produtos && item.quantidade < item.produtos.estoque_minimo;
                  return (
                    <tr key={item.id} className="hover:bg-muted/50 transition-colors">
                      <td className="p-4 font-medium text-foreground">{item.produtos?.nome}</td>
                      <td className="p-4 text-foreground">{item.quantidade} {item.produtos?.unidade}</td>
                      <td className="p-4">
                        {isBaixo ? (
                          <Badge variant="destructive" className="text-xs">Baixo</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs bg-success/10 text-success border-0">Normal</Badge>
                        )}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">{new Date(item.updated_at).toLocaleDateString("pt-BR")}</td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleDecrease(item)} title="Diminuir 1"><Minus className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleRemove(item.id)} title="Remover"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="sm:hidden divide-y divide-border">
          {itens.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">Nenhum item no estoque.</div>
          ) : (
            itens.map((item) => {
              const isBaixo = item.produtos && item.quantidade < item.produtos.estoque_minimo;
              return (
                <div key={item.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-foreground">{item.produtos?.nome}</p>
                    {isBaixo ? (
                      <Badge variant="destructive" className="text-xs">Baixo</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs bg-success/10 text-success border-0">Normal</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {item.quantidade} {item.produtos?.unidade} · {new Date(item.updated_at).toLocaleDateString("pt-BR")}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDecrease(item)}><Minus className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemove(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Estoque;
