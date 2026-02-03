# PWA Invoice – GraphQL snippets

Target endpoint: `http://localhost:8080/query` (update if different). Send header `Content-Type: application/json`. Authenticated calls also need header `token: <login-token>`.

## 1) Login – get token

```bash
curl -X POST http://localhost:8080/query \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation Login($u:String!,$p:String!){login(username:$u,password:$p){token name role}}","variables":{"u":"demo","p":"password"}}'
```

Response includes `login.token` used as `token` header.

## 2) Quick add customer

```bash
curl -X POST http://localhost:8080/query \
  -H "Content-Type: application/json" \
  -H "token: REPLACE_WITH_TOKEN" \
  -d '{"query":"mutation AddCustomer($input:NewCustomer!){createCustomer(input:$input){id name currency{symbol}}}","variables":{"input":{"name":"Acme Mobile","currencyId":1,"customerPaymentTerms":"DueOnReceipt"}}}'
```

Minimal required: `name`, `currencyId`; optional: payment terms, contact fields, taxes, addresses.

## 3) Quick add item/product

```bash
curl -X POST http://localhost:8080/query \
  -H "Content-Type: application/json" \
  -H "token: REPLACE_WITH_TOKEN" \
  -d '{"query":"mutation AddProduct($input:NewProduct!){createProduct(input:$input){id name sku barcode salesPrice}}","variables":{"input":{"name":"Consulting Hours","unitId":1,"salesPrice":150,"sku":"CONS-001","barcode":"AUTO-CONS-001"}}}'
```

Required: `name`, `unitId`; optional price, SKU/barcode (you can auto-generate), taxes/accounts if needed.

## 4) Create invoice with lines

```bash
curl -X POST http://localhost:8080/query \
  -H "Content-Type: application/json" \
  -H "token: REPLACE_WITH_TOKEN" \
  -d '{
    "query": "mutation CreateInvoice($input:NewSalesInvoice!){createSalesInvoice(input:$input){id invoiceNumber customer{ id name } invoiceDate invoiceTotalAmount details{ id name detailQty detailUnitRate }}}",
    "variables": {
      "input": {
        "customerId": 1,
        "branchId": 1,
        "invoiceDate": "2026-01-29T00:00:00Z",
        "invoicePaymentTerms": "DueOnReceipt",
        "currencyId": 1,
        "warehouseId": 1,
        "currentStatus": "Draft",
        "details": [
          {"name":"Consulting","detailQty":1,"detailUnitRate":150,"detailDiscount":0},
          {"name":"Hardware","detailQty":2,"detailUnitRate":320,"detailDiscount":0}
        ]
      }
    }
  }'
```

### Update invoice

Switch mutation name to `updateSalesInvoice` and add `id` argument plus `input` shaped like above.

### Delete invoice

```bash
curl -X POST http://localhost:8080/query \
  -H "Content-Type: application/json" \
  -H "token: REPLACE_WITH_TOKEN" \
  -d '{"query":"mutation DeleteInvoice($id:ID!){deleteSalesInvoice(id:$id){id invoiceNumber}}","variables":{"id":123}}'
```

## 5) List/search helpers

- List customers for picker:

```bash
curl -X POST http://localhost:8080/query \
  -H "Content-Type: application/json" \
  -H "token: REPLACE_WITH_TOKEN" \
  -d '{"query":"query ListCustomers($name:String){listCustomer(name:$name){id name currency{symbol}}}","variables":{"name":"acme"}}'
```

- Paginate products for picker:

```bash
curl -X POST http://localhost:8080/query \
  -H "Content-Type: application/json" \
  -H "token: REPLACE_WITH_TOKEN" \
  -d '{"query":"query SearchProducts($name:String){paginateProduct(name:$name){edges{node{id name salesPrice barcode}}}}","variables":{"name":"con"}}'
```
