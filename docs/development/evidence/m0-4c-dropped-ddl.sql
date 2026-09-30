-- What database/migrations/0043_drop_x_collection.sql drops or narrows, as it stood at main 465a3d8
-- (39 migrations, PostgreSQL 18.1). Row counts on that freshly migrated database (there is no deployed instance):
--   quote_translations: 0
--   articles with x_post or x_article: 0
--   sources of kind x_search: 0
--   publications with channel x: 0
--   budgets row for socialdata: socialdata 10/100/1000 X 搜索（按请求计费）

-- Columns of articles dropped:
--   x_article jsonb
--   x_post jsonb

-- Constraints narrowed:
--   publications.publications_channel_check: CHECK ((channel = ANY (ARRAY['news'::text, 'x'::text])))
--   sources.sources_kind_check: CHECK ((kind = ANY (ARRAY['rss'::text, 'web_list'::text, 'json_list'::text, 'x_search'::text, 'mp_account'::text, 'external'::text])))

-- Table dropped: pg_dump --schema-only --no-owner --no-privileges -t quote_translations
--
-- PostgreSQL database dump
--






--
-- Name: quote_translations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_translations (
    tweet_id text NOT NULL,
    text_hash text NOT NULL,
    text_zh text NOT NULL,
    origin text DEFAULT 'model'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT quote_translations_origin_check CHECK ((origin = ANY (ARRAY['model'::text, 'reused'::text])))
);


--
-- Name: quote_translations quote_translations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_translations
    ADD CONSTRAINT quote_translations_pkey PRIMARY KEY (tweet_id);


--
-- PostgreSQL database dump complete
--


