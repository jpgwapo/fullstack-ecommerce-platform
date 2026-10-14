<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', fn (Blueprint $t) => $t->boolean('is_admin')->default(false));
        Schema::create('products', function (Blueprint $t) {
            $t->id();
            $t->string('name');
            $t->string('category');
            $t->text('description');
            $t->unsignedInteger('price_cents');
            $t->unsignedInteger('stock');
            $t->string('image');
            $t->timestamps();
        });
        Schema::create('orders', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained();
            $t->unsignedInteger('total_cents');
            $t->string('status')->default('paid');
            $t->json('shipping');
            $t->timestamps();
        });
        Schema::create('order_items', function (Blueprint $t) {
            $t->id();
            $t->foreignId('order_id')->constrained()->cascadeOnDelete();
            $t->foreignId('product_id')->constrained();
            $t->string('name');
            $t->unsignedInteger('price_cents');
            $t->unsignedInteger('quantity');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('products');
        Schema::table('users', fn (Blueprint $t) => $t->dropColumn('is_admin'));
    }
};
