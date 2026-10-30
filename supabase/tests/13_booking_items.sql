-- Line items drive the booking subtotal; GST follows when it was charged.
begin;

select tests.login('aaaaaaaa-0000-4000-8000-000000000005');  -- ops
-- Fixture booking 901: subtotal 300000, discount 20000, tax 50400 (GST on, 18%).
insert into booking_items (booking_id, description, quantity, unit_price)
values ('00000000-0000-4000-a000-000000000901', 'Veg plate', 400, 800);
select tests.eq((select subtotal from bookings where id = '00000000-0000-4000-a000-000000000901'), 320000.00::numeric, 'subtotal = items');
select tests.eq((select tax from bookings where id = '00000000-0000-4000-a000-000000000901'), 54000.00::numeric, 'GST recomputed on (320000 - 20000)');

insert into booking_items (booking_id, description, quantity, unit_price, line_discount)
values ('00000000-0000-4000-a000-000000000901', 'DJ', 1, 15000, 5000);
select tests.eq((select subtotal from bookings where id = '00000000-0000-4000-a000-000000000901'), 330000.00::numeric, 'line discount applied');

update booking_items set quantity = 300 where description = 'Veg plate';
select tests.eq((select subtotal from bookings where id = '00000000-0000-4000-a000-000000000901'), 250000.00::numeric, 'quantity change updates subtotal');

delete from booking_items where description = 'Veg plate';
select tests.eq((select subtotal from bookings where id = '00000000-0000-4000-a000-000000000901'), 10000.00::numeric, 'delete updates subtotal');
select tests.eq((select discount from bookings where id = '00000000-0000-4000-a000-000000000901'), 10000.00::numeric, 'discount capped at subtotal');
select tests.eq((select total from bookings where id = '00000000-0000-4000-a000-000000000901'), 0.00::numeric, 'total never negative');

select tests.throws($$
  insert into booking_items (booking_id, description, quantity, unit_price, line_discount)
  values ('00000000-0000-4000-a000-000000000901', 'Bad', 1, 100, 200)
$$, '23514', 'line discount cannot exceed the line');
select tests.logout();

-- No-GST booking stays without GST.
select tests.login('aaaaaaaa-0000-4000-8000-000000000003');  -- sales_a1
create temporary table t_nb (id uuid);
grant select, insert on t_nb to authenticated;
insert into t_nb select public.create_booking('00000000-0000-4000-a000-000000000203', '2027-04-01', 'lunch', '+919800000123', 'No GST');
insert into booking_items (booking_id, description, quantity, unit_price)
select id, 'Hall', 1, 40000 from t_nb;
select tests.eq((select tax from bookings where id = (select id from t_nb)), 0.00::numeric, 'no GST stays no GST');
select tests.eq((select subtotal from bookings where id = (select id from t_nb)), 40000.00::numeric, 'sales can itemise own booking');

-- Sales cannot itemise someone else's booking (901 was created by ops).
select tests.throws($$
  insert into booking_items (booking_id, description, quantity, unit_price)
  values ('00000000-0000-4000-a000-000000000901', 'Sneaky', 1, 1)
$$, '42501', 'sales cannot add items to others'' bookings');
select tests.logout();

rollback;
