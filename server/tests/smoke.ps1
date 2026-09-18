# Voltix API smoke tests
$ErrorActionPreference = 'Continue'
$BASE = 'http://localhost:5000/api'

function J($o) { $o | ConvertTo-Json -Compress }

Write-Host "`n== 1. Public catalog =="
$list = Invoke-RestMethod "$BASE/products"
Write-Host "approved products: $($list.count) -> " ($list.products | ForEach-Object { $_.name }) -ForegroundColor Gray

$meta = Invoke-RestMethod "$BASE/products/meta"
Write-Host "brands: $($meta.brands -join ', ')"

$first = $list.products[0]
$detail = Invoke-RestMethod "$BASE/products/$($first._id)"
Write-Host "detail hotspots on '$($detail.product.name)': $($detail.product.hotspots.Count)"

Write-Host "`n== 2. Auth flows =="
try {
  Invoke-RestMethod -Method Post "$BASE/auth/login" -ContentType 'application/json' -Body '{"email":"pending@voltix.com","password":"seller123"}' | Out-Null
  Write-Host "FAIL: pending seller logged in" -ForegroundColor Red
} catch {
  Write-Host "pending seller blocked: $($_.Error.Response.StatusCode.value__) '$($_.Error.Message)'" -ForegroundColor Green
}

$admin = Invoke-RestMethod -Method Post "$BASE/auth/login" -ContentType 'application/json' -Body '{"email":"admin@voltix.com","password":"admin123"}'
$seller = Invoke-RestMethod -Method Post "$BASE/auth/login" -ContentType 'application/json' -Body '{"email":"seller@voltix.com","password":"seller123"}'
$cust = Invoke-RestMethod -Method Post "$BASE/auth/login" -ContentType 'application/json' -Body '{"email":"customer@voltix.com","password":"cust123"}'
Write-Host "logins ok -> admin:$($admin.user.role) seller:$($seller.user.role)/$($seller.user.status) customer:$($cust.user.role)"
$AH = @{ Authorization = "Bearer $($admin.token)" }
$SH = @{ Authorization = "Bearer $($seller.token)" }
$CH = @{ Authorization = "Bearer $($cust.token)" }

Write-Host "`n== 3. Admin queues =="
$pendSellers = Invoke-RestMethod "$BASE/admin/sellers?status=pending" -Headers $AH
Write-Host "pending sellers: $($pendSellers.sellers.Count) ($($pendSellers.sellers.email -join ', '))"
$pendProducts = Invoke-RestMethod "$BASE/admin/products?status=pending" -Headers $AH
Write-Host "pending products: $($pendProducts.products.Count) ($($pendProducts.products.name -join ', '))"
Invoke-RestMethod -Method Patch "$BASE/admin/sellers/$($pendSellers.sellers[0]._id)/status" -Headers $AH -ContentType 'application/json' -Body '{"status":"approved"}' | Out-Null
Write-Host "approved pending seller."

Write-Host "`n== 4. Seller CRUD + upload guard =="
$newP = Invoke-RestMethod -Method Post "$BASE/seller/products" -Headers $SH -ContentType 'application/json' -Body (@{
  name='Test Phone X'; brand='TestCo'; category='smartphone'; price=199; stock=5;
  specs=@(@{key='Display';value='6.1 inch'}); variants=@(@{name='Color';values=@('Black','Blue')});
  hotspots=@(@{title='Screen';description='Nice';position=@{x=0;y=0;z=0.3}})
} | ConvertTo-Json -Depth 6)
Write-Host "created product status=$($newP.product.status) id=$($newP.product._id)"
$mine = Invoke-RestMethod "$BASE/seller/products" -Headers $SH
Write-Host "seller now owns $($mine.products.Count) products"

Write-Host "`n== 5. Cart + order flow =="
$variant = @(@{name='Color'; value='Blue'})
$add = Invoke-RestMethod -Method Post "$BASE/cart" -Headers $CH -ContentType 'application/json' -Body (@{productId=$first._id; qty=2; variant=$variant} | ConvertTo-Json -Depth 4)
Write-Host "cart count after add: $($add.count)"
$cart = Invoke-RestMethod "$BASE/cart" -Headers $CH
Write-Host "cart subtotal: $($cart.subtotal)  items: $($cart.cart.items.Count)"
$orderId = Invoke-RestMethod -Method Post "$BASE/orders" -Headers $CH -ContentType 'application/json' -Body (@{shippingAddress=@{fullName='Demo Cust'; phone='555'; line1='1 Main St'; city='Addis'; country='Ethiopia'}} | ConvertTo-Json -Depth 4)
Write-Host "order placed id=$($orderId.order._id) total=$($orderId.order.total) items=$($orderId.order.items.Count)"
$stockAfter = Invoke-RestMethod "$BASE/products/$($first._id)"
Write-Host "stock decremented: $($first.stock) -> $($stockAfter.product.stock)"
$ordersMine = Invoke-RestMethod "$BASE/orders/mine" -Headers $CH
Write-Host "my orders count: $($ordersMine.orders.Count)"

Write-Host "`n== 6. Role guards =="
foreach ($h in @(@('seller', $SH), @('admin', $AH))) {
  try {
    Invoke-RestMethod -Method Post "$BASE/cart" -Headers $h[1] -ContentType 'application/json' -Body (@{productId=$first._id} | ConvertTo-Json) | Out-Null
    Write-Host "note: $($h[0]) can use cart (allowed by design)" -ForegroundColor Yellow
  } catch { Write-Host "$($h[0]) cart blocked: $($_.Error.Response.StatusCode.value__)" -ForegroundColor Green }
}
try {
  Invoke-RestMethod "$BASE/seller/products" -Headers $CH | Out-Null
  Write-Host "FAIL: customer accessed seller routes" -ForegroundColor Red
} catch { Write-Host "customer->seller route blocked: $($_.Error.Response.StatusCode.value__)" -ForegroundColor Green }
try {
  Invoke-RestMethod "$BASE/admin/products" -Headers $SH | Out-Null
  Write-Host "FAIL: seller accessed admin routes" -ForegroundColor Red
} catch { Write-Host "seller->admin route blocked: $($_.Error.Response.StatusCode.value__)" -ForegroundColor Green }

Write-Host "`nALL SMOKE TESTS DONE"
