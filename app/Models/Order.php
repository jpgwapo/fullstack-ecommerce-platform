<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class Order extends Model {protected $guarded=[];protected $casts=['shipping'=>'array'];public function items(){return $this->hasMany(OrderItem::class);}}
