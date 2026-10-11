-- CreateEnum
CREATE TYPE "FaseFunil" AS ENUM ('LEAD', 'REUNIAO', 'PROPOSTA', 'FECHAMENTO');

-- CreateEnum
CREATE TYPE "CategoriaServico" AS ENUM ('TRAFEGO', 'SOCIAL_MEDIA', 'SITES', 'SEO', 'BRANDING', 'OUTROS');

-- CreateEnum
CREATE TYPE "TipoInteracao" AS ENUM ('REUNIAO', 'CALL', 'WHATSAPP');

-- AlterEnum
ALTER TYPE "StatusCliente" ADD VALUE 'PROSPECCAO';

-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "dataVencimentoContrato" TIMESTAMP(3),
ADD COLUMN     "faseFunil" "FaseFunil";

-- AlterTable
ALTER TABLE "Financeiro" ADD COLUMN     "categoriaServico" "CategoriaServico";

-- CreateTable
CREATE TABLE "Interacao" (
    "id" TEXT NOT NULL,
    "tipo" "TipoInteracao" NOT NULL,
    "dataInteracao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "descricao" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "responsavelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Interacao_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Interacao" ADD CONSTRAINT "Interacao_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interacao" ADD CONSTRAINT "Interacao_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
