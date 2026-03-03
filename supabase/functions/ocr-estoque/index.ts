import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { image_base64, produtos } = await req.json();

    if (!image_base64) {
      return new Response(JSON.stringify({ error: "Nenhuma imagem enviada." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const produtosList = (produtos || [])
      .map((p: { nome: string; unidade: string }) => `- ${p.nome} (${p.unidade})`)
      .join("\n");

    const systemPrompt = `Você é um assistente que extrai itens de compras/estoque a partir de imagens de notas fiscais, listas de compras, cupons ou fotos de produtos.

Analise a imagem e extraia os itens encontrados. Para cada item, retorne:
- nome: nome do produto (normalizado, sem marcas quando possível)
- quantidade: quantidade numérica (default 1 se não visível)
- unidade: "kg" ou "unidade"

Produtos cadastrados no sistema:
${produtosList || "(nenhum cadastrado ainda)"}

Se um item da imagem corresponder a um produto cadastrado, use exatamente o mesmo nome.

IMPORTANTE: Responda APENAS com o JSON, sem markdown, sem explicação. Use o formato:
[{"nome": "Arroz", "quantidade": 2, "unidade": "kg"}, ...]

Se não conseguir identificar itens, retorne: []`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia os itens desta imagem para adicionar ao estoque:" },
              { type: "image_url", image_url: { url: image_base64 } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em breve." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes para IA." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";

    // Try to parse the JSON from the response
    let items = [];
    try {
      // Remove markdown code fences if present
      const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      items = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
      items = [];
    }

    return new Response(JSON.stringify({ items }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ocr-estoque error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
