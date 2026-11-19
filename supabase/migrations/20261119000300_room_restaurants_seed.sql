-- Starting list of restaurants near Sudha Vatika (Dhoomanganj / Transport Nagar / Mundera), taken from
-- public directory listings (yappe.in, HappyCow, magicpin). Numbers and delivery can be out of date:
-- the guest page tells guests to confirm when they call. Owners and managers can edit all of this in
-- the dashboard. Safe to run twice.
insert into public.room_restaurants (org_id, name, area, cuisine, diet, phone, hours, menu_url, note, sort)
select o.id, v.name, v.area, v.cuisine, v.diet, v.phone, v.hours, v.menu_url, v.note, v.sort
from (select id from public.organizations order by created_at limit 1) o
cross join (values
  ('Kalevam Restaurant', 'Transport Nagar, Dhoomanganj', 'Pure vegetarian', 'veg', '+916387231571', null, null,
   'Ask if home delivery is available today.', 10),
  ('Makkhan''s Veg Restaurant', 'Mundera Road, Transport Nagar', 'Pure vegetarian', 'veg', '+917080115400', null, null, null, 20),
  ('Pizzano', 'Neem Sarai Road, Mundera Mandi', 'Pizza, bakery and cafe', 'mixed', '+915324070818', '11:00 AM to 10:30 PM', null, null, 30),
  ('Red Chilli Indian Restaurant', 'Union Bhawan, Transport Nagar', 'North Indian', 'mixed', '+919026293743', null, null, null, 40),
  ('Royal Rasoi', 'G.T. Road, Mundera Bazar', 'Indian', 'mixed', '+919721437111', null, null,
   'Takeaway (packing) available; ask about delivery.', 50),
  ('Red Chilli Kitchen', 'Dhoomanganj', 'Chinese, North Indian, fast food', 'mixed', null, '3:00 PM to 10:00 PM',
   'https://magicpin.in/Allahabad/Dhoomanganj/Restaurant/Red-Chilli-Kitchen/store/57749c/menu', 'Menu on magicpin.', 60)
) as v(name, area, cuisine, diet, phone, hours, menu_url, note, sort)
where not exists (
  select 1 from public.room_restaurants r where r.org_id = o.id and r.name = v.name
);
