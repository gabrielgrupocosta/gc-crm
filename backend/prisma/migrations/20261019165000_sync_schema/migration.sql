-- CreateEnum
CREATE TYPE "TipoVendedor" AS ENUM ('GC', 'TERCEIRIZADO');

-- CreateEnum
CREATE TYPE "StatusProposta" AS ENUM ('RASCUNHO', 'ENVIADO', 'ASSINADO', 'ATIVO');

-- CreateEnum
CREATE TYPE "ClassificacaoSaude" AS ENUM ('SAUDAVEL', 'ATENCAO', 'CRITICO');

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'FINANCEIRO', 'GESTOR_PL', 'VENDEDOR', 'SDR_CLOSER', 'COLABORADOR');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'COLABORADOR';
COMMIT;

-- AlterEnum
ALTER TYPE "StatusCliente" ADD VALUE 'CANCELADO';

-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "vendedorId" TEXT;

-- AlterTable
ALTER TABLE "Documento" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "propostaId" TEXT;

-- AlterTable
ALTER TABLE "Financeiro" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Interacao" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Unidade" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "gestorId" TEXT,
ADD COLUMN     "metas" DECIMAL(10,2),
ADD COLUMN     "permissoes" JSONB,
ADD COLUMN     "tipoVendedor" "TipoVendedor",
ADD COLUMN     "unidadeId" TEXT,
ALTER COLUMN "role" SET DEFAULT 'COLABORADOR';

-- CreateTable
CREATE TABLE "Proposta" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "status" "StatusProposta" NOT NULL DEFAULT 'RASCUNHO',
    "valor" DECIMAL(10,2) NOT NULL,
    "descricao" TEXT,
    "dataEnvio" TIMESTAMP(3),
    "dataAssinatura" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Proposta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvaliacaoDesempenho" (
    "id" TEXT NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "avaliadorId" TEXT NOT NULL,
    "mesReferencia" TIMESTAMP(3) NOT NULL,
    "notas" JSONB,
    "feedback" TEXT,
    "notaGeral" INTEGER,
    "feedbackTexto" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AvaliacaoDesempenho_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SnapshotUnidade" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "mesReferencia" TIMESTAMP(3) NOT NULL,
    "faturamento" DECIMAL(10,2) NOT NULL,
    "mrr" DECIMAL(10,2) NOT NULL,
    "churnRate" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SnapshotUnidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnaliseCliente" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "mesReferencia" TIMESTAMP(3) NOT NULL,
    "notaCSAT" INTEGER,
    "riscos" TEXT,
    "planoAcao" TEXT,
    "classificacao" "ClassificacaoSaude" NOT NULL,
    "notaOperador" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AnaliseCliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cancelamento" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "tentativasRetencao" TEXT,
    "receitaPerdida" DECIMAL(10,2) NOT NULL,
    "dataCancelamento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Cancelamento_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_gestorId_fkey" FOREIGN KEY ("gestorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "Proposta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposta" ADD CONSTRAINT "Proposta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposta" ADD CONSTRAINT "Proposta_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvaliacaoDesempenho" ADD CONSTRAINT "AvaliacaoDesempenho_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvaliacaoDesempenho" ADD CONSTRAINT "AvaliacaoDesempenho_avaliadorId_fkey" FOREIGN KEY ("avaliadorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnapshotUnidade" ADD CONSTRAINT "SnapshotUnidade_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnaliseCliente" ADD CONSTRAINT "AnaliseCliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cancelamento" ADD CONSTRAINT "Cancelamento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
