-- O FECP não é adicional universal: cada estado define a lista de produtos
-- sobre a qual incide. A coluna diz se, para aquela UF, o adicional entra por
-- padrão (aplicação geral com exceções) ou só quando o usuário confirmar.
ALTER TABLE "AliquotaUf" ADD COLUMN "fecpPadrao" BOOLEAN NOT NULL DEFAULT false;
