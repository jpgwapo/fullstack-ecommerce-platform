<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local', 'testing')) {
            throw new \RuntimeException('Demo seeding is restricted to local/testing.');
        }
        foreach ([['Demo Customer', 'customer@forma.test', false], ['Demo Admin', 'admin@forma.test', true]] as [$name,$email,$admin]) {
            $u = User::firstOrNew(['email' => $email]);
            $u->name = $name;
            $u->password = Hash::make('Portfolio2026!');
            $u->is_admin = $admin;
            $u->save();
        }
        $rows = [['Studio headphones', 'Technology', 'Immersive sound. A quieter everyday.', 12900, 18, 'photo-1505740420928-5e560c06d30e'], ['Everyday backpack', 'Accessories', 'Room for everything, wherever the day takes you.', 3800, 25, 'photo-1553062407-98eeb64c6a62'], ['Arc lounge chair', 'Living', 'A sculptural seat for your favorite corner.', 24900, 6, 'photo-1567538096630-e0c55bd6374c'], ['Analog watch', 'Accessories', 'A timeless dial with a soft leather strap.', 8900, 12, 'photo-1524805444758-089113d48a6d'], ['Ceramic coffee mugs', 'Living', 'Make your morning a little more intentional.', 4200, 20, 'photo-1495474472287-4d71bcdd2085'], ['Pocket speaker', 'Technology', 'Big sound, wherever the day takes you.', 6900, 3, 'photo-1608043152269-423dbba4e7e1'], ['Essential sneakers', 'Accessories', 'Clean lines. All-day comfort.', 9500, 15, 'photo-1549298916-b41d501d3772'], ['Desk light', 'Living', 'Warm light for focused evenings.', 7800, 9, 'photo-1507473885765-e6ed057f782c']];
        foreach ($rows as [$name,$category,$description,$price,$stock,$image]) {
            Product::updateOrCreate(['name' => $name], ['category' => $category, 'description' => $description, 'price_cents' => $price, 'stock' => $stock, 'image' => 'https://images.unsplash.com/'.$image.'?auto=format&fit=crop&w=900&q=80']);
        }
    }
}
