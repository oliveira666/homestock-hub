import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";

interface EstoqueItem {
  id: string;
  quantidade: number;
  updated_at: string;
  produtos: {
    nome: string;
    unidade: string;
    estoque_minimo: number;
  } | null;
}

const Estoque = () => {
  const { user } = useAuth();
  const [itens, setItens] = useState<EstoqueItem[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("dispensa_itens")
      .select("id, quantidade, updated_at, produtos(nome, unidade, estoque_minimo)")
      .order("updated_at", { ascending: false })
      .then(({ data }) => setItens((data as any) || []));
  }, [user]);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Estoque</h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Visão administrativa do estoque
        </p>
      </div>

      {/* Tabela responsiva */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Produto</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Quantidade</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Unidade</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Atualizado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {itens.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground text-sm sm:text-base">
                  Nenhum item no estoque.
                </td>
              </tr>
            ) : (
              itens.map((item) => {
                const isBaixo =
                  item.produtos && item.quantidade < item.produtos.estoque_minimo;
                return (
                  <tr key={item.id} className="hover:bg-muted/50 transition-colors">
                    <td className="p-3 font-medium text-foreground">{item.produtos?.nome}</td>
                    <td className="p-3 text-foreground">{item.quantidade}</td>
                    <td className="p-3 text-muted-foreground">{item.produtos?.unidade}</td>
                    <td className="p-3">
                      {isBaixo ? (
                        <Badge variant="destructive" className="text-xs">
                          Estoque baixo
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="text-xs bg-success/10 text-success border-0"
                        >
                          Normal
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {new Date(item.updated_at).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Estoque;