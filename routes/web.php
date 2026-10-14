<?php
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\StoreController as Store;
Route::prefix('api')->group(function(){
 Route::get('/products',[Store::class,'products']);
 Route::post('/register',[Store::class,'register'])->middleware('throttle:5,1');
 Route::post('/login',[Store::class,'login'])->middleware('throttle:5,1');
 Route::middleware('auth')->group(function(){
 Route::get('/user',fn(Illuminate\Http\Request $r)=>$r->user());
 Route::post('/logout',[Store::class,'logout']);
 Route::get('/orders',[Store::class,'orders']);
 Route::post('/checkout',[Store::class,'checkout'])->middleware('throttle:10,1');
 Route::get('/admin/dashboard',[Store::class,'dashboard']);
 Route::post('/admin/products',[Store::class,'saveProduct']);
 Route::put('/admin/products/{product}',[Store::class,'saveProduct']);
 Route::delete('/admin/products/{product}',[Store::class,'deleteProduct']);
 });
});
Route::get('/{path?}',fn()=>view('store'))->where('path','(?!api).*');
