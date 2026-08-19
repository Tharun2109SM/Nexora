do $$ begin
  if (select article_status from public.knowledge_base_articles where id='c9000000-0000-4000-8000-000000000001') <> 'PUBLISHED' then raise exception 'published knowledge mapping failed'; end if;
  if (select audience_mode from public.knowledge_base_articles where id='c9000000-0000-4000-8000-000000000001') <> 'PRODUCT_SCOPED' then raise exception 'product audience mapping failed'; end if;
  if (select audience_mode from public.knowledge_base_articles where id='c9000000-0000-4000-8000-000000000002') <> 'SELECTED_ORGANIZATION' then raise exception 'organization target precedence failed'; end if;
  if not exists(select 1 from pg_indexes where schemaname='public' and indexname='knowledge_articles_search_idx') then raise exception 'knowledge search index missing'; end if;
  if not exists(select 1 from pg_proc where proname='get_staff_analytics') then raise exception 'analytics function missing'; end if;
  perform set_config('request.jwt.claims','{"sub":"99000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  if ((select public.get_staff_analytics('30D',null,null))->'delivery'->>'publishedArticles')::integer <> 1 then raise exception 'populated article aggregate failed'; end if;
end $$;
select 'Populated Milestone 6 through Milestones 7 and 8 upgrade passed.' as result;
