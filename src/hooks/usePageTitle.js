import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Mapa central rota → título de exibição — pra adicionar uma tela nova ao
// título da aba, só acrescentar uma entrada aqui (nenhuma página precisa
// mexer em document.title individualmente).
const TITULOS_POR_ROTA = {
  '/dashboard':    'Dashboard',
  '/ranking':      'Ranking',
  '/comparativo':  'Comparativo',
  '/controle':     'Relatório Semanal',
  '/atividades':   'Atividades',
  '/clientes':     'Clientes',
  '/lojas':        'Lojas',
  '/contratos':    'Contratos',
  '/financeiro':   'Financeiro',
  '/onboard':      'Onboard',
  '/carteira':     'Desempenho da Carteira',
  '/gestores':     'Gestores',
  '/crm':          'CRM',
  '/feedback':     'Feedback',
  '/organizacoes': 'Organizações',
  '/login':        'Login',
}

// Aplica o título da aba a cada troca de rota — chamado uma única vez, no
// componente raiz das rotas, em vez de repetir em cada página.
export default function usePageTitle() {
  const location = useLocation()

  useEffect(() => {
    const nomeTela = TITULOS_POR_ROTA[location.pathname]
    document.title = nomeTela ? `iHubFood | ${nomeTela}` : 'iHubFood'
  }, [location.pathname])
}
