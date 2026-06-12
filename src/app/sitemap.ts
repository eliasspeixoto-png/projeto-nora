import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://nora.tec.br';
  const lastModified = new Date();

  const routes = [
    '',
    '/dashboard',
    '/clientes',
    '/produtos',
    '/orcamentos',
    '/ordem-de-servico',
    '/marketing',
    '/financeiro',
    '/estoque',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified,
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  return routes;
}
