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
import { Trash2, Minus, Plus, Upload, Search } from "lucide-react";

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

interface ItemLine {
  produto_id: string;
  quantidade: string;
}

const Estoque = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [itens, setItens] = useState<EstoqueItem[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [search, setSearch] = useState("");
  const [clearPrevious, setClearPrevious] = useState(false);
  const [lines, setLines] = useState<ItemLine[]>([{ produto_id: "", quantidade: "" }]);
  const [submitLoading, setSubmitLoading] = useState(false);

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

  // --- Unified add (single or multiple) ---
  const addLine = () => setLines([...lines, { produto_id: "", quantidade: "" }]);

  const updateLine = (index: number, field: keyof ItemLine, value: string) => {
    const updated = [...lines];
    updated[index][field] = value;
    setLines(updated);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!user) return;
    const validLines = lines.filter((l) => l.produto_id && Number(l.quantidade) > 0);
    if (validLines.length === 0) {
      toast({ title: "Erro", description: "Adicione ao menos um item válido.", variant: "destructive" });
      return;
    }

    setSubmitLoading(true);

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

    toast({
      title: validLines.length === 1 ? "Item adicionado!" : "Itens adicionados!",
      description: `${validLines.length} item(ns) processado(s).`,
    });
    setLines([{ produto_id: "", quantidade: "" }]);
    setClearPrevious(false);
    setSubmitLoading(false);
    fetchItens();
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

  // --- Filter ---
  const filteredItens = itens.filter((item) =>
    !search || item.produtos?.nome?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Estoque</h1>
        <p className="text-sm text-muted-foreground">Gerencie os itens da sua dispensa</p>
      </div>

      {/* Unified add form */}
      <div className="glass-card p-4 sm:p-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-foreground">Adicionar Itens</h2>
          {lines.length > 1 && (
            <div className="flex items-center gap-2">
              <Switch checked={clearPrevious} onCheckedChange={setClearPrevious} id="clear" />
              <Label htmlFor="clear" className="text-sm text-muted-foreground">Limpar estoque anterior</Label>
            </div>
          )}
        </div>

        {produtos.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum produto cadastrado. Cadastre um produto primeiro.</p>
        ) : (
          <>
            <div className="space-y-3">
              {lines.map((line, i) => {
                const unit = produtos.find((p) => p.id === line.produto_id)?.unidade || "";
                return (
                  <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="flex-1 space-y-1">
                      {i === 0 && <Label className="text-xs text-muted-foreground">Produto</Label>}
                      <Select value={line.produto_id} onValueChange={(v) => updateLine(i, "produto_id", v)}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {produtos.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-full sm:w-28 space-y-1">
                      {i === 0 && <Label className="text-xs text-muted-foreground">Qtd {unit && `(${unit})`}</Label>}
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={line.quantidade}
                        onChange={(e) => updateLine(i, "quantidade", e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => removeLine(i)}
                      disabled={lines.length <= 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <Button variant="outline" size="sm" onClick={addLine}>
                <Plus className="h-4 w-4 mr-1" /> Mais um item
              </Button>
              <Button onClick={handleSubmit} disabled={submitLoading} size="sm">
                <Upload className="h-4 w-4 mr-2" />
                {submitLoading ? "Salvando..." : lines.length > 1 ? "Salvar todos" : "Adicionar"}
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Stock list */}
      <div className="glass-card">
        <div className="p-4 sm:p-6 border-b border-border flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-semibold text-foreground">Itens em Estoque</h2>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filtrar por nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
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
              {filteredItens.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">
                  {search ? "Nenhum item encontrado." : "Nenhum item no estoque."}
                </td></tr>
              ) : (
                filteredItens.map((item) => {
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
          {filteredItens.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              {search ? "Nenhum item encontrado." : "Nenhum item no estoque."}
            </div>
          ) : (
            filteredItens.map((item) => {
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
