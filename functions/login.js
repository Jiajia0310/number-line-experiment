export async function onRequestGet() {
  return showLoginPage('');
}

export async function onRequestPost(context) {
  try {
    const formData = await context.request.formData();
    const code = String(formData.get('code') || '').trim();

    // ACCESS_CODE 来自 Cloudflare Secret
    // 真正的访问码不会写入 GitHub
    if (code !== context.env.ACCESS_CODE) {
      return showLoginPage('访问码错误，请重新输入。', 401);
    }

    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/',
        'Set-Cookie':
          'experiment_auth=1; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=14400'
      }
    });

  } catch (error) {
    return showLoginPage('验证失败，请重新尝试。', 500);
  }
}

function showLoginPage(errorMessage = '', status = 200) {
  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>数轴标记实验</title>

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      background: #f7f7f7;
      font-family: Arial, "Microsoft YaHei", sans-serif;
      color: #222;
    }

    .card {
      width: min(420px, calc(100% - 40px));
      padding: 40px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
    }

    h1 {
      margin: 0 0 28px;
      text-align: center;
      font-size: 28px;
    }

    p {
      margin-bottom: 18px;
      line-height: 1.7;
    }

    input {
      width: 100%;
      padding: 13px 14px;
      margin-bottom: 18px;
      border: 1px solid #bbb;
      border-radius: 6px;
      font-size: 18px;
    }

    button {
      width: 100%;
      padding: 13px;
      border: 0;
      border-radius: 6px;
      font-size: 18px;
      cursor: pointer;
    }

    .error {
      color: #b00020;
    }
  </style>
</head>

<body>

  <div class="card">

    <h1>数轴标记实验</h1>

    <p>
      请输入研究人员提供的实验访问码。
    </p>

    ${
      errorMessage
        ? `<p class="error">${escapeHtml(errorMessage)}</p>`
        : ''
    }

    <form method="POST" action="/login">

      <input
        type="password"
        name="code"
        placeholder="请输入访问码"
        autocomplete="off"
        required
        autofocus
      >

      <button type="submit">
        进入实验
      </button>

    </form>

  </div>

</body>
</html>
`;

  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=UTF-8',
      'Cache-Control': 'no-store'
    }
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}