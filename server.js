const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.get(
  '/.well-known/appspecific/com.tesla.3p.public-key.pem',
  (req, res) => {
    res.type('application/x-pem-file');
    res.send(process.env.TESLA_PUBLIC_KEY);
  }
);

app.get("/auth", (req, res) => {
  const state = crypto.randomUUID();

  const url =
    "https://auth.tesla.com/oauth2/v3/authorize" +
    "?response_type=code" +
    "&client_id=" + process.env.TESLA_CLIENT_ID +
    "&redirect_uri=" + process.env.TESLA_REDIRECT_URI +
    "&scope=openid offline_access vehicle_device_data" +
    "&state=" + state;

  res.redirect(url);
});

app.get("/auth/callback", async (req, res) => {
  const code = req.query.code;

  const response = await fetch(
    "https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.TESLA_CLIENT_ID,
        client_secret: process.env.TESLA_CLIENT_SECRET,
        audience: "https://fleet-api.prd.na.vn.cloud.tesla.com",
        redirect_uri: process.env.TESLA_REDIRECT_URI,
        code: code
      }),
    }
  );

  const data = await response.json();
  console.log(data);

  res.send("Auth complete");
});

app.listen(port, () => {
  console.log(`app listening on port ${port}`);
});