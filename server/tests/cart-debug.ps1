# Reproduce: login -> add to cart -> GET /api/cart (what CartPage renders)
$BASE = 'http://localhost:5000/api'

$cust = Invoke-RestMethod -Method Post "$BASE/auth/login" -ContentType 'application/json' `
  -Body '{"email":"customer@voltix.com","password":"cust123"}'
$CH = @{ Authorization = "Bearer $($cust.token)" }

$list = Invoke-RestMethod "$BASE/products"
$p1 = $list.products[0]
Write-Host "adding product: $($p1.name) ($($p1._id))"

$variant = @(@{name='Color'; value='Graphite'})
try {
  $add = Invoke-RestMethod -Method Post "$BASE/cart" -Headers $CH -ContentType 'application/json' `
    -Body (@{productId=$p1._id; qty=2; variant=$variant} | ConvertTo-Json -Depth 4)
  Write-Host "ADD ok -> count=$($add.count)"
} catch {
  Write-Host "ADD FAILED: $($_.Error.Message)" -ForegroundColor Red
}

$cart = Invoke-RestMethod "$BASE/cart" -Headers $CH
Write-Host "`nGET /api/cart response shape:"
Write-Host ("> count   : $($cart.count)")
Write-Host ("> subtotal: $($cart.subtotal)")
Write-Host ("> items   : $($cart.cart.items.Count)")
foreach ($i in $cart.cart.items) {
  Write-Host "  - itemId='$($i._id)' productType=$($i.product.GetType().Name)"
  if ($i.product -is [string]) {
    Write-Host "    !! product NOT POPULATED (raw ObjectId)" -ForegroundColor Red
  } else {
    Write-Host "    name=$($i.product.name) price=$($i.product.price) status=$($i.product.status) images=$($i.product.images.Count)"
  }
}
