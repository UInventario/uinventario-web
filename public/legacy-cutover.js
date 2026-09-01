(() => {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const identityRoutes = new Map([
    ['/login', '/v2/login'],
    ['/onboarding', '/v2/onboarding'],
    ['/recuperar', '/v2/recuperar'],
    ['/registro', '/v2/registro'],
    ['/restablecer', '/v2/restablecer'],
  ]);
  const target =
    identityRoutes.get(path) ??
    (path === '/app' || path.startsWith('/app/') ? '/v2/dashboard/resumen' : '/v2/');

  location.replace(`${target}${location.search}`);
})();
