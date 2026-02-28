import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Package, ShoppingBasket, AlertTriangle, Clock } from "lucide-react";

interface Stats {
  totalProdutos: number;
  totalItens: number;
  estoqueBaixo: number;
  ultimosItens: Array<{
    id: string;
    quantidade: number;
    updated_at: string;
    produtos: { nome: string; unidade: string } | null;
  }>;
}

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalProdutos: 0,
    totalItens: 0,
    estoqueBaixo: 0,
    ultimosItens: [],
  });

  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      const [produtosRes, itensRes, baixoRes, ultimosRes] = await Promise.all([
        supabase.from("produtos").select("id", { count: "exact", head: true }),
        supabase.from("dispensa_itens").select("id", { count: "exact", head: true }),
        supabase
          .from("dispensa_itens")
          .select("quantidade, produtos!inner(estoque_minimo)")
          .then(({ data }) =>
            (data || []).filter(
              (item: any) => item.quantidade < item.produtos.estoque_minimo
            ).length
          ),
        supabase
          .from("dispensa_itens")
          .select("id, quantidade, updated_at, produtos(nome, unidade)")
          .order("updated_at", { ascending: false })
          .limit(5),
      ]);

      setStats({
        totalProdutos: produtosRes.count || 0,
        totalItens: itensRes.count || 0,
        estoqueBaixo: baixoRes as number,
        ultimosItens: (ultimosRes.data as any) || [],
      });
    };

    fetchStats();
  }, [user]);

  const statCards = [
    { label: "Total de Produtos", value: stats.totalProdutos, icon: Package, color: "text-primary" },
    { label: "Itens na Dispensa", value: stats.totalItens, icon: ShoppingBasket, color: "text-success" },
    { label: "Estoque Baixo", value: stats.estoqueBaixo, icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral da sua dispensa</p>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-lg shadow p-4 flex items-center justify-between"
          >
            <div>
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1">{card.value}</p>
            </div>
            <card.icon className={`h-8 w-8 ${card.color} opacity-80`} />
          </div>
        ))}
      </div>

      {/* Últimos itens */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-foreground text-sm sm:text-base">Últimos itens atualizados</h2>
        </div>
        <div className="divide-y divide-border">
          {stats.ultimosItens.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm sm:text-base">
              Nenhum item na dispensa ainda.
            </div>
          ) : (
            stats.ultimosItens.map((item) => (
              <div key={item.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{item.produtos?.nome}</p>
                  <p className="text-sm text-muted-foreground mt-1 sm:mt-0">
                    {new Date(item.updated_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <span className="text-sm font-medium text-foreground mt-2 sm:mt-0">
                  {item.quantidade} {item.produtos?.unidade}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;