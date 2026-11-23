// Keep this beside src/app so Next.js applies it to every request.
export function middleware() {
  return new Response('404', {
    status: 404,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export const config = {
  matcher: ['/:path*'],
};
