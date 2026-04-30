<?php

use App\Models\Order;
use Illuminate\Support\Facades\Artisan;

Artisan::command('sales:export {path=storage/app/sales.csv}', function () {
    $path = $this->argument('path');
    $file = fopen($path, 'w');
    if (! $file) {
        $this->error('Cannot open export path');

        return 1;
    }
    fputcsv($file, ['order_id', 'date', 'product', 'quantity', 'price_cents', 'status'], ',', '"', '');
    Order::with('items')->orderBy('id')->chunk(100, function ($orders) use ($file) {
        foreach ($orders as $order) {
            foreach ($order->items as $item) {
                fputcsv($file, [$order->id, $order->created_at->toDateString(), $item->name, $item->quantity, $item->price_cents, $order->status], ',', '"', '');
            }
        }
    });
    fclose($file);
    $this->info('Exported sales to '.$path);
})->purpose('Export sales line items for the Python report');
