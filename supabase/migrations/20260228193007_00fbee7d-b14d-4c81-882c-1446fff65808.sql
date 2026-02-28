
-- Create unit enum
CREATE TYPE public.product_unit AS ENUM ('kg', 'unidade');

-- Create produtos table
CREATE TABLE public.produtos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  unidade product_unit NOT NULL DEFAULT 'unidade',
  estoque_minimo NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create dispensa_itens table
CREATE TABLE public.dispensa_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  quantidade NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(usuario_id, produto_id)
);

-- Enable RLS
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispensa_itens ENABLE ROW LEVEL SECURITY;

-- RLS for produtos
CREATE POLICY "Users can view own products" ON public.produtos FOR SELECT USING (auth.uid() = usuario_id);
CREATE POLICY "Users can create own products" ON public.produtos FOR INSERT WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "Users can update own products" ON public.produtos FOR UPDATE USING (auth.uid() = usuario_id);
CREATE POLICY "Users can delete own products" ON public.produtos FOR DELETE USING (auth.uid() = usuario_id);

-- RLS for dispensa_itens
CREATE POLICY "Users can view own pantry items" ON public.dispensa_itens FOR SELECT USING (auth.uid() = usuario_id);
CREATE POLICY "Users can create own pantry items" ON public.dispensa_itens FOR INSERT WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "Users can update own pantry items" ON public.dispensa_itens FOR UPDATE USING (auth.uid() = usuario_id);
CREATE POLICY "Users can delete own pantry items" ON public.dispensa_itens FOR DELETE USING (auth.uid() = usuario_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_dispensa_itens_updated_at
BEFORE UPDATE ON public.dispensa_itens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
