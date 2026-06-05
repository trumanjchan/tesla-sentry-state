async function saveTokens(data, env) {
  const result = await env.tokens.prepare(`
    INSERT OR REPLACE INTO tokens (
      id,
      access_token,
      refresh_token,
      expires_at
    ) VALUES (?, ?, ?, ?)
  `).bind(
    1,
    data.access_token,
    data.refresh_token,
    Date.now() + (data.expires_in * 1000)
  ).run();

  console.log("D1 insert result:", result.success);
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

      try {
        await saveTokens(data, env);
      } catch (error) {
        console.error("Error saving auth tokens:", error);
      }

      return new Response("Auth complete");
    }

    if (url.pathname === "/trigger-sync") {
      const incomingKey = request.headers.get("X-API-Key");
      if (!incomingKey || incomingKey !== env.MY_SECRET_API_KEY) {
        console.error("Unauthorized access attempt blocked.");
        return new Response("Unauthorized", { status: 401 });
      }

      const { results } = await env.tokens.prepare(
        "SELECT access_token, refresh_token, expires_at FROM tokens WHERE id = 1"
      ).all();
      if (!results || results.length === 0) {
        return new Response("No access token found in database", { status: 500 });
      }

      const tokenData = results[0];
      let accessToken = tokenData.access_token;

      if (Date.now() >= tokenData.expires_at) {
        console.log("Access token expired. Refreshing...");

        const response = await fetch(
          "https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              grant_type: "refresh_token",
              client_id: env.TESLA_CLIENT_ID,
              refresh_token: tokenData.refresh_token,
            }),
          }
        );

        const data = await response.json();

        try {
          await saveTokens(data, env);

          accessToken = data.access_token;
        } catch (error) {
          console.error("Error saving refreshed tokens:", error);
        }
      }

      const vin = env.TESLA_VIN; 
      const teslaResponse = await fetch(
        `https://fleet-api.prd.na.vn.cloud.tesla.com/api/1/vehicles/${vin}/vehicle_data`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!teslaResponse.ok) {
        const errorText = await teslaResponse.text();
        return new Response(`Tesla API Error: ${errorText}`, { status: teslaResponse.status });
      }

      const vehicleData = await teslaResponse.json();
      const isLocked = vehicleData.response.vehicle_state.locked;
      const sentryOn = vehicleData.response.vehicle_state.sentry_mode;
      const battery = vehicleData.response.charge_state.battery_level;


      console.log(`Car Sync Complete. Locked: ${isLocked}, Sentry: ${sentryOn}, Battery: ${battery}%`);

      return new Response(JSON.stringify({ success: true, isLocked, sentryOn, battery }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response("Not Found", {
      status: 404,
    });
  },
};