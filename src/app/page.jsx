import { redirect } from 'next/navigation';

export default function HomePage() {
  // O Next.js permite redirecionamento direto no lado do servidor.
  // Por enquanto, mandamos para o /login ou /dashboard
  redirect('/dashboard');
}
