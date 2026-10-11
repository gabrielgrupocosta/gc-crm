import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Limpando banco de dados...');
  // Apaga dados na ordem inversa de dependência
  await prisma.cancelamento.deleteMany({});
  await prisma.analiseCliente.deleteMany({});
  await prisma.snapshotUnidade.deleteMany({});
  await prisma.avaliacaoDesempenho.deleteMany({});
  await prisma.proposta.deleteMany({});
  await prisma.interacao.deleteMany({});
  await prisma.documento.deleteMany({});
  await prisma.financeiro.deleteMany({});
  await prisma.cliente.deleteMany({});
  await prisma.unidade.deleteMany({});
  await prisma.user.deleteMany({});
  
  console.log('🌱 Semeando banco com dados fictícios...');

  const senha = await bcrypt.hash('senha123', 10);

  // 1. Admin Geral
  const admin = await prisma.user.create({
    data: {
      nome: 'Admin Global',
      email: 'admin@grupocosta.com',
      senha,
      role: 'ADMIN',
    }
  });

  // 2. Gestores de Unidade
  const gestorCuritiba = await prisma.user.create({
    data: {
      nome: 'Gestor Curitiba',
      email: 'gestor.cwb@grupocosta.com',
      senha,
      role: 'GESTOR_PL',
    }
  });

  const gestorSP = await prisma.user.create({
    data: {
      nome: 'Gestor São Paulo',
      email: 'gestor.sp@grupocosta.com',
      senha,
      role: 'GESTOR_PL',
    }
  });

  // 3. Profissional CS
  const cs = await prisma.user.create({
    data: {
      nome: 'Equipe CS',
      email: 'cs@grupocosta.com',
      senha,
      role: 'COLABORADOR',
    }
  });

  // 4. Unidades
  const unidadeCWB = await prisma.unidade.create({
    data: {
      nome: 'Unidade Curitiba',
      cnpj: '11111111000111',
      endereco: 'Rua das Flores, 100',
      responsavelId: gestorCuritiba.id
    }
  });

  const unidadeSP = await prisma.unidade.create({
    data: {
      nome: 'Unidade São Paulo',
      cnpj: '22222222000122',
      endereco: 'Avenida Paulista, 200',
      responsavelId: gestorSP.id
    }
  });

  // 5. Vendedores
  const vendedorCwb1 = await prisma.user.create({
    data: {
      nome: 'Vendedor CWB 1', email: 'vend1.cwb@grupocosta.com', senha, role: 'VENDEDOR', tipoVendedor: 'GC', gestorId: gestorCuritiba.id, unidadeId: unidadeCWB.id, metas: 30000
    }
  });
  const vendedorCwb2 = await prisma.user.create({
    data: {
      nome: 'Vendedor CWB 2', email: 'vend2.cwb@grupocosta.com', senha, role: 'VENDEDOR', tipoVendedor: 'TERCEIRIZADO', gestorId: gestorCuritiba.id, unidadeId: unidadeCWB.id, metas: 20000
    }
  });
  const vendedorSp1 = await prisma.user.create({
    data: {
      nome: 'Vendedor SP 1', email: 'vend1.sp@grupocosta.com', senha, role: 'VENDEDOR', tipoVendedor: 'GC', gestorId: gestorSP.id, unidadeId: unidadeSP.id, metas: 50000
    }
  });
  const vendedorSp2 = await prisma.user.create({
    data: {
      nome: 'Vendedor SP 2', email: 'vend2.sp@grupocosta.com', senha, role: 'VENDEDOR', tipoVendedor: 'TERCEIRIZADO', gestorId: gestorSP.id, unidadeId: unidadeSP.id, metas: 35000
    }
  });

  // 6. Clientes e Financeiro Retroativo (Mês atual, Mês -1, Mês -2)
  const today = new Date();
  
  const generateDates = (monthsAgo: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() - monthsAgo);
    return d;
  };

  const statusList = ['ATIVO', 'ATIVO', 'PROSPECCAO', 'ATIVO', 'CANCELADO'];
  let clientesCwb = [];
  let clientesSp = [];

  for(let i=1; i<=8; i++) {
    const s = statusList[i % 5];
    const isCancelado = s === 'CANCELADO';
    
    // CWB
    const cli = await prisma.cliente.create({
      data: {
        razaoSocial: `Cliente CWB ${i} LTDA`,
        nomeFantasia: `Marca CWB ${i}`,
        cnpjCpf: `333333330001${i}0`,
        email: `contato@marcacwb${i}.com`,
        status: s as any,
        unidadeId: unidadeCWB.id,
        vendedorId: i % 2 === 0 ? vendedorCwb1.id : vendedorCwb2.id
      }
    });
    clientesCwb.push(cli);

    // Se Ativo ou Cancelado, gerar lançamentos
    if(s === 'ATIVO' || s === 'CANCELADO') {
      const valorBase = 2000 + (i * 500);
      for(let m=0; m<=2; m++) {
        // Se cancelado, não gera receita pro mês atual (m=0)
        if (isCancelado && m === 0) continue; 
        
        await prisma.financeiro.create({
          data: {
            tipo: 'MENSALIDADE',
            categoriaServico: 'TRAFEGO',
            valor: valorBase,
            dataCompetencia: generateDates(m),
            statusPagamento: 'PAGO',
            clienteId: cli.id
          }
        });
      }

      // Proposta Fechada
      await prisma.proposta.create({
        data: {
          clienteId: cli.id,
          vendedorId: cli.vendedorId!,
          status: 'ATIVO',
          valor: valorBase,
          createdAt: generateDates(3)
        }
      });
      
      if (isCancelado) {
        await prisma.cancelamento.create({
          data: {
            clienteId: cli.id,
            motivo: 'Corte de Custos',
            receitaPerdida: valorBase,
            dataCancelamento: generateDates(0) // Cancelou neste mês
          }
        });
      }
    }
  }

  for(let i=1; i<=7; i++) {
    const s = statusList[i % 5];
    const isCancelado = s === 'CANCELADO';
    
    // SP
    const cli = await prisma.cliente.create({
      data: {
        razaoSocial: `Cliente SP ${i} S.A`,
        nomeFantasia: `Marca SP ${i}`,
        cnpjCpf: `444444440001${i}0`,
        email: `contato@marcasp${i}.com`,
        status: s as any,
        unidadeId: unidadeSP.id,
        vendedorId: i % 2 === 0 ? vendedorSp1.id : vendedorSp2.id
      }
    });
    clientesSp.push(cli);

    if(s === 'ATIVO' || s === 'CANCELADO') {
      const valorBase = 4000 + (i * 1000);
      for(let m=0; m<=2; m++) {
        if (isCancelado && m === 0) continue; 
        
        await prisma.financeiro.create({
          data: {
            tipo: 'MENSALIDADE',
            categoriaServico: 'OUTROS',
            valor: valorBase,
            dataCompetencia: generateDates(m),
            statusPagamento: m === 0 && i === 1 ? 'ATRASADO' : 'PAGO', // Um atrasado pro admin ver
            clienteId: cli.id
          }
        });
      }
      
      await prisma.proposta.create({
        data: {
          clienteId: cli.id,
          vendedorId: cli.vendedorId!,
          status: 'ATIVO',
          valor: valorBase,
          createdAt: generateDates(2)
        }
      });

      if (isCancelado) {
        await prisma.cancelamento.create({
          data: {
            clienteId: cli.id,
            motivo: 'Expectativas não alinhadas',
            receitaPerdida: valorBase,
            dataCancelamento: generateDates(0)
          }
        });
      }
    }
  }

  // 7. Avaliação de Desempenho
  await prisma.avaliacaoDesempenho.create({
    data: {
      colaboradorId: vendedorCwb1.id,
      avaliadorId: gestorCuritiba.id,
      mesReferencia: generateDates(0),
      notas: { comunicacao: 5, tecnica: 4, prazos: 4 },
      feedback: 'Ótimo mês de vendas. Continue prospectando novos nichos.'
    }
  });

  console.log('✅ Banco de dados preenchido com sucesso!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
