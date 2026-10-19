import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import authRoutes from './routes/authRoutes';
import usersRoutes from './routes/usersRoutes';
import unidadesRoutes from './routes/unidadesRoutes';
import clientesRoutes from './routes/clientesRoutes';
import financeiroRoutes from './routes/financeiroRoutes';
import documentosRoutes from './routes/documentosRoutes';
import interacoesRoutes from './routes/interacoesRoutes';
import alertasRoutes from './routes/alertasRoutes';
import contratosRoutes from './routes/contratosRoutes';
import avaliacoesRoutes from './routes/avaliacoesRoutes';
import csRoutes from './routes/csRoutes';
import dashboardsRoutes from './routes/dashboardsRoutes';

const app = express();
const PORT = process.env.PORT || 3333;
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origem nao permitida pelo CORS.'));
  },
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rotas
app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/unidades', unidadesRoutes);
app.use('/clientes', clientesRoutes);
app.use('/financeiro', financeiroRoutes);
app.use('/documentos', documentosRoutes);
app.use('/interacoes', interacoesRoutes);
app.use('/alertas', alertasRoutes);
app.use('/contratos', contratosRoutes);
app.use('/avaliacoes', avaliacoesRoutes);
app.use('/cs', csRoutes);
app.use('/dashboards', dashboardsRoutes);

// Rota de teste
app.get('/', (req, res) => {
  res.json({ message: 'API CRM Agência de Marketing está rodando!' });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
