begin;
select plan(34);

insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data) values
('97000000-0000-4000-8000-000000000001','authenticated','authenticated','knowledge-admin@test','x','{"nexora_account_type":"BEAUROI"}','{"full_name":"Knowledge Admin"}'),
('97000000-0000-4000-8000-000000000002','authenticated','authenticated','knowledge-employee@test','x','{"nexora_account_type":"BEAUROI"}','{"full_name":"Knowledge Employee"}'),
('97000000-0000-4000-8000-000000000003','authenticated','authenticated','knowledge-a@test','x','{"nexora_account_type":"BEAUROI"}','{"full_name":"Knowledge Customer A"}'),
('97000000-0000-4000-8000-000000000004','authenticated','authenticated','knowledge-b@test','x','{"nexora_account_type":"BEAUROI"}','{"full_name":"Knowledge Customer B"}');
insert into public.organizations(id,name,slug,organization_type) values
('a7000000-0000-4000-8000-000000000001','Knowledge Beau Roi','knowledge-beau-roi','BEAUROI'),
('a7000000-0000-4000-8000-000000000002','Knowledge Customer A','knowledge-customer-a','CUSTOMER'),
('a7000000-0000-4000-8000-000000000003','Knowledge Customer B','knowledge-customer-b','CUSTOMER');
insert into public.organization_memberships(organization_id,user_id,role,status,is_primary,joined_at) values
('a7000000-0000-4000-8000-000000000001','97000000-0000-4000-8000-000000000001','BEAUROI_ADMIN','ACTIVE',true,now()),
('a7000000-0000-4000-8000-000000000001','97000000-0000-4000-8000-000000000002','BEAUROI_EMPLOYEE','ACTIVE',true,now()),
('a7000000-0000-4000-8000-000000000002','97000000-0000-4000-8000-000000000003','CUSTOMER_ADMIN','ACTIVE',true,now()),
('a7000000-0000-4000-8000-000000000003','97000000-0000-4000-8000-000000000004','CUSTOMER_MEMBER','ACTIVE',true,now());
insert into public.products(id,code,name,status) values
('b7000000-0000-4000-8000-000000000001','KNOWLEDGE_ONE','Knowledge Product One','ACTIVE'),
('b7000000-0000-4000-8000-000000000002','KNOWLEDGE_TWO','Knowledge Product Two','ACTIVE');
insert into public.customer_subscriptions(organization_id,product_id,status) values
('a7000000-0000-4000-8000-000000000002','b7000000-0000-4000-8000-000000000001','ACTIVE'),
('a7000000-0000-4000-8000-000000000003','b7000000-0000-4000-8000-000000000002','ACTIVE');

select ok(not has_table_privilege('authenticated','public.knowledge_base_articles','INSERT'),'direct article insert is revoked');
select ok(not has_table_privilege('authenticated','public.knowledge_base_articles','UPDATE'),'direct article update is revoked');
select ok(not has_table_privilege('authenticated','public.knowledge_base_articles','DELETE'),'article deletion is revoked');
select ok(not has_table_privilege('authenticated','public.knowledge_article_events','INSERT'),'event forgery is revoked');
select ok(not has_column_privilege('authenticated','public.knowledge_base_articles','author_user_id','SELECT'),'author identity is not exposed');
select ok(not has_column_privilege('authenticated','public.knowledge_base_articles','reviewed_by','SELECT'),'reviewer identity is not exposed');
select ok(not has_function_privilege('authenticated','private.assert_knowledge_admin()','EXECUTE'),'private admin helper is hidden');
select ok(has_function_privilege('authenticated','public.create_knowledge_article(text,text,text,text,uuid,uuid,text,uuid,text)','EXECUTE'),'narrow article creation RPC is exposed');

set local role authenticated;
set local request.jwt.claims='{"sub":"97000000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$select public.create_knowledge_article('Employee article',null,'Not authorized','GUIDE',null,null,'INTERNAL',null,null)$$,'42501','Knowledge management requires an active Beau Roi administrator','ordinary employee cannot mutate knowledge');

reset role; set local role authenticated;
set local request.jwt.claims='{"sub":"97000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select public.create_knowledge_article('Subscriber guide','Approved summary','Secure searchable subscriber guidance','GUIDE',null,'b7000000-0000-4000-8000-000000000001','PRODUCT_SCOPED',null,'https://example.com/guide')$$,'administrator creates a product-scoped draft');
select is((select article_status from public.knowledge_base_articles where title='Subscriber guide'),'DRAFT','article begins as draft');
select lives_ok($$select public.transition_knowledge_article((select id from public.knowledge_base_articles where title='Subscriber guide'),'IN_REVIEW')$$,'draft enters review');

reset role; set local role authenticated;
set local request.jwt.claims='{"sub":"97000000-0000-4000-8000-000000000003","role":"authenticated"}';
select is((select count(*)::integer from public.knowledge_base_articles),0,'review article is hidden from customer');

reset role; set local role authenticated;
set local request.jwt.claims='{"sub":"97000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select public.transition_knowledge_article((select id from public.knowledge_base_articles where title='Subscriber guide'),'PUBLISHED')$$,'reviewed article is published');
select throws_ok($$select public.update_knowledge_article_content((select id from public.knowledge_base_articles where title='Subscriber guide'),'Changed title',null,'Changed body',null)$$,'23514','Published or archived article content is immutable','published content is immutable');
select throws_ok($$select public.transition_knowledge_article((select id from public.knowledge_base_articles where title='Subscriber guide'),'DRAFT')$$,'23514','Invalid knowledge article lifecycle transition','published article cannot skip lifecycle backward');

reset role; set local role authenticated;
set local request.jwt.claims='{"sub":"97000000-0000-4000-8000-000000000003","role":"authenticated"}';
select is((select count(*)::integer from public.knowledge_base_articles),1,'eligible subscriber sees published article');
select is((select count(*)::integer from public.knowledge_base_articles where search_document @@ websearch_to_tsquery('english','searchable guidance')),1,'search evaluates only the caller-visible article');
select ok(exists(select 1 from public.notifications where category='KNOWLEDGE'),'eligible customer receives publication notification');

reset role; set local role authenticated;
set local request.jwt.claims='{"sub":"97000000-0000-4000-8000-000000000004","role":"authenticated"}';
select is((select count(*)::integer from public.knowledge_base_articles),0,'wrong-product subscriber cannot read product article');
select is((select count(*)::integer from public.notifications),0,'wrong-product customer receives no notification');

reset role; set local role authenticated;
set local request.jwt.claims='{"sub":"97000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select public.create_knowledge_article('Internal operations','Staff only','Private internal guidance','REFERENCE',null,null,'INTERNAL',null,null)$$,'administrator creates internal article');
select lives_ok($$select public.transition_knowledge_article((select id from public.knowledge_base_articles where title='Internal operations'),'IN_REVIEW'); select public.transition_knowledge_article((select id from public.knowledge_base_articles where title='Internal operations'),'PUBLISHED')$$,'internal article follows publication lifecycle');
select lives_ok($$select public.create_knowledge_article('Selected organization guide',null,'Only customer A may read this','FAQ',null,null,'SELECTED_ORGANIZATION','a7000000-0000-4000-8000-000000000002',null)$$,'administrator creates organization-targeted article');
select lives_ok($$select public.transition_knowledge_article((select id from public.knowledge_base_articles where title='Selected organization guide'),'IN_REVIEW'); select public.transition_knowledge_article((select id from public.knowledge_base_articles where title='Selected organization guide'),'PUBLISHED')$$,'selected article is published');
select throws_ok($$select public.create_knowledge_article('Unsafe URL',null,'Rejected external link','GUIDE',null,null,'INTERNAL',null,'javascript:alert(1)')$$,'23514',null,'unsafe URL scheme is rejected');
select ok(not exists(select 1 from public.audit_events where metadata::text like '%Secure searchable subscriber guidance%'),'article bodies are absent from audit metadata');
select throws_ok($$update public.knowledge_article_events set event_type='ARCHIVED'$$,'42501',null,'article history is immutable to authenticated callers');

reset role; set local role authenticated;
set local request.jwt.claims='{"sub":"97000000-0000-4000-8000-000000000003","role":"authenticated"}';
select is((select count(*)::integer from public.knowledge_base_articles),2,'customer A sees product and selected articles but not internal content');

reset role; set local role authenticated;
set local request.jwt.claims='{"sub":"97000000-0000-4000-8000-000000000004","role":"authenticated"}';
select is((select count(*)::integer from public.knowledge_base_articles),0,'customer B cannot read another organization target or internal content');

reset role; set local role authenticated;
set local request.jwt.claims='{"sub":"97000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select public.transition_knowledge_article((select id from public.knowledge_base_articles where title='Subscriber guide'),'ARCHIVED')$$,'published article can be archived');
reset role; set local role authenticated;
set local request.jwt.claims='{"sub":"97000000-0000-4000-8000-000000000003","role":"authenticated"}';
select is((select count(*)::integer from public.knowledge_base_articles),1,'archived article disappears from customer reads');

reset role;
select lives_ok($$delete from public.knowledge_base_articles where title='Selected organization guide'$$,'database owner cleanup and cascades remain available');
select is((select count(*)::integer from public.knowledge_article_events where article_id not in (select id from public.knowledge_base_articles)),0,'article-event cascade leaves no orphan history');

select * from finish();
rollback;
