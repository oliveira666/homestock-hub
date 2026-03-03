import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Camera, Upload, Loader2, Trash2, Check, FlaskConical } from "lucide-react";

interface ExtractedItem {
  nome: string;
  quantidade: number;
  unidade: string;
  selected: boolean;
  matched_produto_id?: string;
}

interface Produto {
  id: string;
  nome: string;
  unidade: string;
}

const OcrEstoque = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [items, setItems] = useState<ExtractedItem[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchProdutos = async () => {
      const { data } = await supabase.from("produtos").select("id, nome, unidade").order("nome");
      setProdutos((data as Produto[]) || []);
    };
    if (user) fetchProdutos();
  }, [user]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Erro", description: "Imagem muito grande (máx 10MB).", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setImagePreview(base64);
      setImageBase64(base64);
      setItems([]);
    };
    reader.readAsDataURL(file);
  };

  const matchProduto = (nome: string): string | undefined => {
    const lower = nome.toLowerCase().trim();
    const match = produtos.find((p) => p.nome.toLowerCase().trim() === lower);
    return match?.id;
  };

  const handleExtract = async () => {
    if (!imageBase64) return;
    setExtracting(true);

    try {
      const { data, error } = await supabase.functions.invoke("ocr-estoque", {
        body: {
          image_base64: imageBase64,
          produtos: produtos.map((p) => ({ nome: p.nome, unidade: p.unidade })),
        },
      });

      if (error) throw error;

      const extracted: ExtractedItem[] = (data.items || []).map((item: any) => ({
        nome: item.nome,
        quantidade: Number(item.quantidade) || 1,
        unidade: item.unidade || "unidade",
        selected: true,
        matched_produto_id: matchProduto(item.nome),
      }));

      setItems(extracted);

      if (extracted.length === 0) {
        toast({ title: "Nenhum item encontrado", description: "Tente com uma imagem mais nítida.", variant: "destructive" });
      } else {
        toast({ title: `${extracted.length} item(ns) encontrado(s)!` });
      }
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro na extração", description: err.message || "Falha ao processar imagem.", variant: "destructive" });
    } finally {
      setExtracting(false);
    }
  };

  const toggleItem = (index: number) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, selected: !item.selected } : item)));
  };

  const updateItemQty = (index: number, qty: string) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, quantidade: Number(qty) || 0 } : item)));
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!user) return;
    const selected = items.filter((i) => i.selected && i.quantidade > 0);

    if (selected.length === 0) {
      toast({ title: "Erro", description: "Selecione ao menos um item.", variant: "destructive" });
      return;
    }

    const unmatched = selected.filter((i) => !i.matched_produto_id);
    if (unmatched.length > 0) {
      toast({
        title: "Produtos não cadastrados",
        description: `${unmatched.map((u) => u.nome).join(", ")} não encontrado(s). Cadastre-os primeiro em Produtos.`,
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    for (const item of selected) {
      const { data: existing } = await supabase
        .from("dispensa_itens")
        .select("id, quantidade")
        .eq("produto_id", item.matched_produto_id!)
        .eq("usuario_id", user.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("dispensa_itens")
          .update({ quantidade: existing.quantidade + item.quantidade })
          .eq("id", existing.id);
      } else {
        await supabase.from("dispensa_itens").insert({
          usuario_id: user.id,
          produto_id: item.matched_produto_id!,
          quantidade: item.quantidade,
        });
      }
    }

    toast({ title: "Estoque atualizado!", description: `${selected.length} item(ns) adicionado(s).` });
    setItems([]);
    setImagePreview(null);
    setImageBase64(null);
    setSaving(false);
  };

  const reset = () => {
    setImagePreview(null);
    setImageBase64(null);
    setItems([]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-warning" />
          OCR Estoque
          <Badge variant="outline" className="text-xs font-normal text-warning border-warning">Experimental</Badge>
        </h1>
        <p className="text-sm text-muted-foreground">Tire uma foto ou envie uma imagem para extrair itens automaticamente</p>
      </div>

      {/* Upload area */}
      <div className="glass-card p-4 sm:p-6">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelect}
        />

        {!imagePreview ? (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-border rounded-xl p-8 sm:p-12 flex flex-col items-center gap-3 text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
          >
            <Camera className="h-10 w-10" />
            <span className="text-sm font-medium">Toque para tirar foto ou selecionar imagem</span>
            <span className="text-xs">Nota fiscal, lista de compras, cupom...</span>
          </button>
        ) : (
          <div className="space-y-4">
            <div className="relative rounded-lg overflow-hidden bg-muted">
              <img src={imagePreview} alt="Preview" className="w-full max-h-64 object-contain" />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <Button variant="outline" size="sm" onClick={reset}>
                <Trash2 className="h-4 w-4 mr-2" /> Trocar imagem
              </Button>
              <Button size="sm" onClick={handleExtract} disabled={extracting}>
                {extracting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analisando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" /> Extrair itens
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Extracted items */}
      {items.length > 0 && (
        <div className="glass-card p-4 sm:p-6 space-y-4">
          <h2 className="text-base font-semibold text-foreground">Itens Encontrados</h2>

          <div className="space-y-3">
            {items.map((item, i) => (
              <div
                key={i}
                className={`flex flex-col gap-2 sm:flex-row sm:items-center p-3 rounded-lg border transition-colors ${
                  item.selected ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30 opacity-60"
                }`}
              >
                <button
                  onClick={() => toggleItem(i)}
                  className={`shrink-0 h-5 w-5 rounded border flex items-center justify-center transition-colors ${
                    item.selected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground"
                  }`}
                >
                  {item.selected && <Check className="h-3 w-3" />}
                </button>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">{item.nome}</p>
                  {item.matched_produto_id ? (
                    <Badge variant="secondary" className="text-xs bg-success/10 text-success border-0 mt-1">Cadastrado</Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs mt-1">Não cadastrado</Badge>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={item.quantidade}
                    onChange={(e) => updateItemQty(i, e.target.value)}
                    className="w-20 text-center"
                    disabled={!item.selected}
                  />
                  <span className="text-xs text-muted-foreground w-14">{item.unidade}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeItem(i)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center pt-2 border-t border-border">
            <p className="text-sm text-muted-foreground">
              {items.filter((i) => i.selected).length} de {items.length} selecionado(s)
            </p>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" /> Adicionar ao estoque
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OcrEstoque;
