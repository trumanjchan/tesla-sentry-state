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

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});