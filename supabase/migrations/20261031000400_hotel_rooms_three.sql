-- Only 3 hotel rooms are open at the moment; the rest are still to come.
-- Raise the number again here (Inventory page) when more rooms open.
update public.units set quantity = 3 where name = 'Hotel rooms' and kind = 'room';
