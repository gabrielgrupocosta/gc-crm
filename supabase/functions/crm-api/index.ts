import { Hono } from 'npm:hono@4.10.7';
import { corsMiddleware } from './platform.ts';
import type { AppEnv } from './types.ts';
import { alertasRoutes } from './routes/alertas.ts';
import { authRoutes } from './routes/auth.ts';
import { avaliacoesRoutes } from './routes/avaliacoes.ts';
import { clientesRoutes } from './routes/clientes.ts';
import { contratosRoutes } from './routes/contratos.ts';
import { csRoutes } from './routes/cs.ts';
import { dashboardsRoutes } from './routes/dashboards.ts';
import { documentosRoutes } from './routes/documentos.ts';
import { financeiroRoutes } from './routes/financeiro.ts';
import { interacoesRoutes } from './routes/interacoes.ts';
import { unidadesRoutes } from './routes/unidades.ts';
import { usersRoutes } from './routes/users.ts';

const app = new Hono<AppEnv>();
app.use('*', corsMiddleware());

const mountRoutes = (router: Hono<AppEnv>) => {
  router.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));
  router.route('/auth', authRoutes);
  router.route('/users', usersRoutes);
  router.route('/unidades', unidadesRoutes);
  router.route('/clientes', clientesRoutes);
  router.route('/financeiro', financeiroRoutes);
  router.route('/documentos', documentosRoutes);
  router.route('/interacoes', interacoesRoutes);
  router.route('/alertas', alertasRoutes);
  router.route('/contratos', contratosRoutes);
  router.route('/avaliacoes', avaliacoesRoutes);
  router.route('/cs', csRoutes);
  router.route('/dashboards', dashboardsRoutes);
};

const prefixed = new Hono<AppEnv>();
mountRoutes(prefixed);
app.route('/functions/v1/crm-api', prefixed);
app.route('/crm-api', prefixed);
app.route('/', prefixed);

app.notFound((c) => c.json({ error: 'Rota nao encontrada.' }, 404));
app.onError((error, c) => {
  console.error('Unhandled CRM API error', error);
  return c.json({ error: 'Erro interno do servidor.' }, 500);
});

Deno.serve(app.fetch);
