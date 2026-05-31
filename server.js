async function saveTokens(data) {
  await env.tokens.prepare(`
    INSERT OR REPLACE INTO tokens (
      access_token,
      refresh_token,
      expires_at
    ) VALUES (?, ?, ?)
  `).bind(
    data.access_token,
    data.refresh_token,
    Date.now() + (data.expires_in * 1000)
  ).run();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response("Hello World!");
    }

    if (
      url.pathname ===
      "/.well-known/appspecific/com.tesla.3p.public-key.pem"
    ) {
      return new Response(env.TESLA_PUBLIC_KEY, {
        headers: {
          "Content-Type": "application/x-pem-file",
        },
      });
    }

    if (url.pathname === "/auth") {
      const state = crypto.randomUUID();

      const authUrl =
        "https://auth.tesla.com/oauth2/v3/authorize" +
        "?response_type=code" +
        "&client_id=" + encodeURIComponent(env.TESLA_CLIENT_ID) +
        "&redirect_uri=" + encodeURIComponent(env.TESLA_REDIRECT_URI) +
        "&scope=openid offline_access vehicle_device_data" +
        "&state=" + state;

      return Response.redirect(authUrl, 302);
    }

    if (url.pathname === "/auth/callback") {
      const code = url.searchParams.get("code");

      const response = await fetch(
        "https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: env.TESLA_CLIENT_ID,
            client_secret: env.TESLA_CLIENT_SECRET,
            audience: "https://fleet-api.prd.na.vn.cloud.tesla.com",
            redirect_uri: env.TESLA_REDIRECT_URI,
            code,
          }),
        }
      );

      const data = await response.json();
      console.log(JSON.stringify(data));

      saveTokens(data);

      return new Response("Auth complete");
    }

    return new Response("Not Found", {
      status: 404,
    });
  },
};