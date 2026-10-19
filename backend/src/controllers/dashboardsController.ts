import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middlewares/auth';


export const getDashboardData = async (req: AuthRequest, res: Response) => {
  try {
    const role = req.user?.role;
    const userId = req.user?.id;
    
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59);

    // --- GAMIFICAÇÃO / RANKINGS ---
    // Buscar propostas ATIVO ou ASSINADO do mês corrente
    const propostasMes = await prisma.proposta.findMany({
      where: {
        status: { in: ['ATIVO', 'ASSINADO'] },
        createdAt: { gte: inicioMes, lte: fimMes },
        deletedAt: null
      },
      include: {
        vendedor: {
          include: { unidade: true }
        }
      }
    });

    // Processar Ranking de Vendedores
    const vendedoresMap: Record<string, { id: string, nome: string, unidade: string, valor: number }> = {};
    const unidadesMap: Record<string, { id: string, nome: string, valor: number, vendedores: Record<string, {nome: string, valor: number}> }> = {};

    propostasMes.forEach(p => {
      if (!p.vendedor) return;
      const vId = p.vendedor.id;
      const uId = p.vendedor.unidadeId || 'MATRIZ';
      const uNome = p.vendedor.unidade?.nome || 'Matriz Global';
      const valor = Number(p.valor || 0);

      if (!vendedoresMap[vId]) {
        vendedoresMap[vId] = { id: vId, nome: p.vendedor.nome, unidade: uNome, valor: 0 };
      }
      vendedoresMap[vId].valor += valor;

      if (!unidadesMap[uId]) {
        unidadesMap[uId] = { id: uId, nome: uNome, valor: 0, vendedores: {} };
      }
      unidadesMap[uId].valor += valor;
      
      if (!unidadesMap[uId].vendedores[vId]) {
        unidadesMap[uId].vendedores[vId] = { nome: p.vendedor.nome, valor: 0 };
      }
      unidadesMap[uId].vendedores[vId].valor += valor;
    });

    const rankingVendedores = Object.values(vendedoresMap).sort((a, b) => b.valor - a.valor);

    const rankingUnidades = Object.values(unidadesMap).map(u => {
      let mvp = { nome: '-', valor: -1 };
      Object.values(u.vendedores).forEach(v => {
        if (v.valor > mvp.valor) {
          mvp = v;
        }
      });
      return {
        id: u.id,
        nome: u.nome,
        valor: u.valor,
        mvp: mvp.valor > 0 ? mvp.nome : '-'
      };
    }).sort((a, b) => b.valor - a.valor);

    // ------------------------------

    if (role === 'ADMIN' || role === 'FINANCEIRO') {
      // 1. MRR Global (Mensalidades Pagas no mês corrente)
      const mrrData = await prisma.financeiro.aggregate({
        _sum: { valor: true },
        where: {
          tipo: 'MENSALIDADE',
          statusPagamento: 'PAGO',
          dataCompetencia: { gte: inicioMes, lte: fimMes },
          deletedAt: null
        }
      });
      const mrrGlobal = Number(mrrData._sum.valor || 0);

      // 2. Churn Rate Global
      const cancelamentosData = await prisma.cancelamento.aggregate({
        _sum: { receitaPerdida: true },
        where: {
          dataCancelamento: { gte: inicioMes, lte: fimMes },
          deletedAt: null
        }
      });
      const receitaPerdida = Number(cancelamentosData._sum.receitaPerdida || 0); // fallback
      
      let churnGlobal = 0;
      const mrrInicioMes = mrrGlobal + receitaPerdida;
      if (mrrInicioMes > 0) {
        churnGlobal = (receitaPerdida / mrrInicioMes) * 100;
      }

      res.json({
        tipo: 'GLOBAL',
        mrr: mrrGlobal,
        churn: churnGlobal.toFixed(2),
        novosClientes: 0, // Mock por ora
        rankingVendedores,
        rankingUnidades
      });
    } else if (role === 'GESTOR_PL') {
      // Unit Dashboard
      const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null }});
      const unidadeId = user?.unidadeId;

      if (!unidadeId) return res.json({ tipo: 'UNIDADE', mrr: 0, churn: 0, notaUnidade: 0 });

      // MRR da Unidade
      const mrrData = await prisma.financeiro.aggregate({
        _sum: { valor: true },
        where: {
          cliente: { unidadeId },
          tipo: 'MENSALIDADE',
          statusPagamento: 'PAGO',
          dataCompetencia: { gte: inicioMes, lte: fimMes },
          deletedAt: null
        }
      });
      const mrrUnidade = Number(mrrData._sum.valor || 0);

      // Nota da Unidade (CSAT + Avaliacao PL) / 2
      const analises = await prisma.analiseCliente.aggregate({
        _avg: { notaCSAT: true },
        where: { cliente: { unidadeId }, deletedAt: null }
      });
      
      // Nota PL (Avaliação) -> Média das avaliações dos colaboradores desta unidade
      const avaliacoes = await prisma.avaliacaoDesempenho.findMany({
        where: { colaborador: { unidadeId }, deletedAt: null }
      });
      
      let mediaPL = 0;
      if (avaliacoes.length > 0) {
        let sum = 0;
        avaliacoes.forEach(a => {
          const n = a.notas as any;
          sum += (n.comunicacao + n.tecnica + n.prazos) / 3;
        });
        mediaPL = sum / avaliacoes.length;
      }

      const notaCliente = Number(analises._avg.notaCSAT || 0);
      const notaUnidade = (notaCliente > 0 && mediaPL > 0) ? ((notaCliente + mediaPL) / 2).toFixed(1) : (notaCliente || mediaPL).toFixed(1);

      res.json({
        tipo: 'UNIDADE',
        mrr: mrrUnidade,
        notaUnidade,
        rankingVendedores,
        rankingUnidades
      });
    } else if (role === 'VENDEDOR') {
      const propostas = await prisma.proposta.aggregate({
        _sum: { valor: true },
        where: { vendedorId: userId, status: 'ATIVO', createdAt: { gte: inicioMes, lte: fimMes }, deletedAt: null }
      });
      const vendasMes = Number(propostas._sum.valor || 0);
      
      const user = await prisma.user.findUnique({ where: { id: userId }});
      let metasAtingidas = '0%';
      if (user?.metas && Number(user.metas) > 0) {
        metasAtingidas = ((vendasMes / Number(user.metas)) * 100).toFixed(0) + '%';
      }

      res.json({
        tipo: 'VENDEDOR',
        vendasMes,
        metasAtingidas,
        rankingVendedores,
        rankingUnidades
      });
    } else {
      res.json({ tipo: 'COMUM', message: 'Visão padrão' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Erro ao gerar dashboard' });
  }
};
