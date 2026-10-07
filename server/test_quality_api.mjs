async function testQuality() {
  const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-Slug': 'ricoz-demo' },
    body: JSON.stringify({ email: 'test@example.com', password: 'password', slug: 'ricoz-demo' })
  });
  const token = (await loginRes.json()).data.accessToken;
  const headers = { 'Authorization': 'Bearer ' + token, 'X-Tenant-Slug': 'ricoz-demo' };

  const customersId = '6ab8f3ea501d04f8ba6e70e7';
  const productsId = '6ab8f3ea501d04f8ba6e70e9';

  console.log('--- CUSTOMERS QUALITY ---');
  const qCust = await (await fetch('http://localhost:5000/api/v1/quality/datasets/' + customersId, { headers })).json();
  console.log(JSON.stringify(qCust, null, 2));

  console.log('--- CUSTOMERS RULES ---');
  const rCust = await (await fetch('http://localhost:5000/api/v1/quality/datasets/' + customersId + '/rules', { headers })).json();
  console.log(JSON.stringify(rCust, null, 2));

  console.log('--- PRODUCTS QUALITY ---');
  const qProd = await (await fetch('http://localhost:5000/api/v1/quality/datasets/' + productsId, { headers })).json();
  console.log(JSON.stringify(qProd, null, 2));

  console.log('--- PRODUCTS RULES ---');
  const rProd = await (await fetch('http://localhost:5000/api/v1/quality/datasets/' + productsId + '/rules', { headers })).json();
  console.log(JSON.stringify(rProd, null, 2));
}

testQuality().catch(console.error);
