<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StoreTest extends TestCase
{
    use RefreshDatabase;

    private function product(int $stock = 5): Product
    {
        return Product::create(['name' => 'Studio headphones', 'category' => 'Technology', 'description' => 'Good sound', 'price_cents' => 12900, 'stock' => $stock, 'image' => 'https://example.com/image.jpg']);
    }

    private function payload(Product $p, int $quantity = 2): array
    {
        return ['items' => [['product_id' => $p->id, 'quantity' => $quantity]], 'shipping' => ['name' => 'Test', 'address' => '123 Street', 'city' => 'Manila', 'postal_code' => '1000'], 'payment' => 'mock', 'total_cents' => 1];
    }

    public function test_catalog_can_be_searched(): void
    {
        $this->product();
        $this->getJson('/api/products?search=Studio')->assertOk()->assertJsonCount(1);
        $this->getJson('/api/products?search=missing')->assertJsonCount(0);
    }

    public function test_registration_login_and_logout(): void
    {
        $this->postJson('/api/register', ['name' => 'Alex', 'email' => 'alex@example.com', 'password' => 'StrongPass123!', 'password_confirmation' => 'StrongPass123!', 'is_admin' => true])->assertCreated();
        $this->assertAuthenticated();
        $this->assertFalse((bool) User::first()->is_admin);
        $this->postJson('/api/logout')->assertOk();
        $this->assertGuest();
        $this->postJson('/api/login', ['email' => 'alex@example.com', 'password' => 'wrong'])->assertUnprocessable();
        $this->postJson('/api/login', ['email' => 'alex@example.com', 'password' => 'StrongPass123!'])->assertOk();
    }

    public function test_checkout_uses_server_prices_and_reduces_inventory(): void
    {
        $p = $this->product();
        $u = User::factory()->create();
        $this->actingAs($u)->postJson('/api/checkout', $this->payload($p))->assertCreated()->assertJsonPath('total_cents', 25800);
        $this->assertSame(3, $p->fresh()->stock);
        $this->assertDatabaseCount('order_items', 1);
    }

    public function test_insufficient_stock_rolls_back_entire_checkout(): void
    {
        $p = $this->product();
        $sold = $this->product(0);
        $data = $this->payload($p);
        $data['items'][] = ['product_id' => $sold->id, 'quantity' => 1];
        $this->actingAs(User::factory()->create())->postJson('/api/checkout', $data)->assertUnprocessable();
        $this->assertSame(5, $p->fresh()->stock);
        $this->assertDatabaseCount('orders', 0);
    }

    public function test_guest_checkout_and_customer_admin_access_are_denied(): void
    {
        $p = $this->product();
        $this->postJson('/api/checkout', $this->payload($p))->assertUnauthorized();
        $this->actingAs(User::factory()->create())->getJson('/api/admin/dashboard')->assertForbidden();
        $this->postJson('/api/admin/products', $p->toArray())->assertForbidden();
    }

    public function test_order_history_is_private(): void
    {
        $p = $this->product();
        $this->actingAs(User::factory()->create())->postJson('/api/checkout', $this->payload($p))->assertCreated();
        $this->actingAs(User::factory()->create())->getJson('/api/orders')->assertOk()->assertJsonCount(0);
    }

    public function test_duplicate_items_are_rejected(): void
    {
        $p = $this->product();
        $data = $this->payload($p);
        $data['items'][] = $data['items'][0];
        $this->actingAs(User::factory()->create())->postJson('/api/checkout', $data)->assertUnprocessable();
        $this->assertSame(5, $p->fresh()->stock);
    }

    public function test_admin_manages_inventory(): void
    {
        $u = User::factory()->create();
        $u->is_admin = true;
        $u->save();
        $this->actingAs($u);
        $p = $this->product();
        $this->putJson('/api/admin/products/'.$p->id, array_merge($p->toArray(), ['stock' => 10]))->assertOk()->assertJsonPath('stock', 10);
        $this->getJson('/api/admin/dashboard')->assertOk();
        $this->deleteJson('/api/admin/products/'.$p->id)->assertNoContent();
    }
}
