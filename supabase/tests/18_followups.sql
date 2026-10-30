-- Balance reminders and feedback: lists, logging, and who may do what.
begin;

select tests.login('aaaaaaaa-0000-4000-8000-000000000001');  -- owner
update organizations set google_review_url = 'https://g.page/r/test/review', upi_id = 'sudhavatika@okaxis';
select tests.throws($$ update organizations set google_review_url = 'javascript:alert(1)' $$, '23514', 'review link must be https');
select tests.throws($$ update organizations set upi_id = 'not a upi' $$, '23514', 'UPI id format checked');

create temporary table t_b as select * from public.balance_reminders(30, '2026-12-01');
select tests.eq((select count(*)::int from t_b), 1, 'booking with balance listed');
select tests.eq((select balance from t_b), 230400.00::numeric, 'balance = total - paid');
select tests.eq((select reminders from t_b), 0, 'not reminded yet');
select tests.eq((select count(*)::int from public.balance_reminders(5, '2026-12-01')), 0, 'outside the window: not listed');
select tests.eq((select count(*)::int from public.balance_reminders(30, '2026-12-13')), 0, 'past events not listed');

insert into booking_touches (booking_id, kind) values ('00000000-0000-4000-a000-000000000901', 'balance_reminder');
select tests.eq((select reminders from public.balance_reminders(30, '2026-12-01')), 1, 'reminder counted');
select tests.throws($$
  insert into booking_touches (booking_id, kind, rating) values ('00000000-0000-4000-a000-000000000901', 'feedback', 6)
$$, '23514', 'rating is 1 to 5');
select tests.logout();

select tests.login('aaaaaaaa-0000-4000-8000-000000000003');  -- sales_a1
select tests.throws($$ select * from public.balance_reminders(30, '2026-12-01') $$, '42501', 'sales cannot list balances');
select tests.throws($$
  insert into booking_touches (booking_id, kind) values ('00000000-0000-4000-a000-000000000901', 'balance_reminder')
$$, '42501', 'sales cannot log a balance reminder');

create temporary table t_f as select * from public.feedback_queue(30, '2026-12-20');
select tests.eq((select count(*)::int from t_f), 1, 'past event waiting for feedback');
select tests.eq((select asked_at is null from t_f), true, 'not asked yet');
insert into booking_touches (booking_id, kind) values ('00000000-0000-4000-a000-000000000901', 'feedback_request');
insert into booking_touches (booking_id, kind, rating, note) values ('00000000-0000-4000-a000-000000000901', 'feedback', 5, 'Great food');
create temporary table t_f2 as select * from public.feedback_queue(30, '2026-12-20');
select tests.eq((select asked_at is not null from t_f2), true, 'request recorded');
select tests.eq((select rating from t_f2), 5::smallint, 'rating recorded');
select tests.eq((select count(*)::int from public.feedback_queue(30, '2026-12-12')), 0, 'event day itself not yet listed');
delete from booking_touches;  -- RLS: sales delete nothing
select tests.eq((select count(*)::int from booking_touches), 3, 'only managers delete');
select tests.logout();

select tests.login('bbbbbbbb-0000-4000-8000-000000000001');  -- other org
select tests.eq((select count(*)::int from booking_touches), 0, 'other org sees nothing');
select tests.eq((select count(*)::int from public.feedback_queue(30, '2026-12-20')), 0, 'other org queue empty');
select tests.logout();

rollback;
