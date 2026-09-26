export async function onRequest(context) {
  const url = new URL(context.request.url);

  // 登录页面必须允许直接访问
  if (url.pathname === '/login') {
    return context.next();
  }

  // 检查是否已经通过访问码验证
  const cookie = context.request.headers.get('Cookie') || '';

  const authenticated = cookie
    .split(';')
    .map(item => item.trim())
    .includes('experiment_auth=1');

  if (authenticated) {
    return context.next();
  }

  // 未验证则进入访问码页面
  return Response.redirect(`${url.origin}/login`, 302);
}