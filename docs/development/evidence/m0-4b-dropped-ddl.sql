-- Definitions of the tables dropped by database/migrations/0042_drop_leaderboard_monitor.sql, as they stood
-- at main d6ee412 (38 migrations, PostgreSQL 18.1): pg_dump --schema-only --no-owner --no-privileges -t <table>.
-- Row counts on that freshly migrated database (there is no deployed instance):
--   lb_rankings: 0
--   lb_scores: 0
--   lb_snapshots: 0
--   lb_aliases: 0
--   lb_prices: 0
--   lb_runs: 0
--   lb_models: 0
--   monitor_event_posts: 0
--   monitor_events: 0
--   monitor_posts: 0
--   monitor_state: 0
--   fx_rates: 0
--
-- PostgreSQL database dump
--






--
-- Name: fx_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fx_rates (
    as_of date NOT NULL,
    pair text NOT NULL,
    rate numeric(12,6) NOT NULL,
    source_name text NOT NULL,
    source_url text,
    fetched_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lb_aliases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lb_aliases (
    id text NOT NULL,
    source_key text NOT NULL,
    alias text NOT NULL,
    normalized_alias text NOT NULL,
    model_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lb_models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lb_models (
    id text NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    provider text,
    provider_slug text,
    released_at timestamp with time zone,
    release_date_source text,
    context_window_tokens integer,
    input_price_usd numeric(12,4),
    output_price_usd numeric(12,4),
    metadata_source text,
    metadata_updated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lb_prices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lb_prices (
    model_id text NOT NULL,
    kind text NOT NULL,
    currency text NOT NULL,
    input numeric(14,6),
    output numeric(14,6),
    cached_input numeric(14,6),
    source_url text,
    verified_on date,
    note text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lb_prices_currency_check CHECK ((currency = ANY (ARRAY['CNY'::text, 'USD'::text]))),
    CONSTRAINT lb_prices_kind_check CHECK ((kind = ANY (ARRAY['official'::text, 'subscription'::text, 'relay'::text])))
);


--
-- Name: lb_rankings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lb_rankings (
    id bigint NOT NULL,
    run_id text NOT NULL,
    board text NOT NULL,
    model_id text NOT NULL,
    rank integer NOT NULL,
    score double precision,
    uncertainty double precision,
    coverage double precision,
    confidence text,
    metric_count integer,
    summary text,
    component_scores jsonb,
    detail jsonb
);


--
-- Name: lb_rankings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lb_rankings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lb_rankings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lb_rankings_id_seq OWNED BY public.lb_rankings.id;


--
-- Name: lb_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lb_runs (
    id text NOT NULL,
    methodology_version text NOT NULL,
    generated_at timestamp with time zone NOT NULL,
    source_snapshot_ids text[] DEFAULT '{}'::text[] NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'published'::text NOT NULL,
    origin text DEFAULT 'computed'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lb_runs_origin_check CHECK ((origin = ANY (ARRAY['computed'::text, 'imported'::text]))),
    CONSTRAINT lb_runs_status_check CHECK ((status = ANY (ARRAY['published'::text, 'failed'::text, 'shadow'::text, 'historical'::text])))
);


--
-- Name: lb_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lb_scores (
    id text NOT NULL,
    snapshot_id text NOT NULL,
    model_id text NOT NULL,
    configuration_key text NOT NULL,
    configuration_label text,
    configuration_kind text,
    configuration_priority integer,
    selected_for_product boolean DEFAULT false NOT NULL,
    selection_reason text,
    metric_key text NOT NULL,
    metric_name text,
    raw_score double precision,
    normalized_score double precision,
    lower_bound double precision,
    upper_bound double precision,
    source_rank integer,
    sample_size integer,
    source_model_name text,
    source_organization text,
    source_published_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lb_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lb_snapshots (
    id text NOT NULL,
    source_key text NOT NULL,
    source_name text NOT NULL,
    source_url text,
    license text,
    attribution_url text,
    content_hash text,
    published_at timestamp with time zone,
    fetched_at timestamp with time zone NOT NULL,
    record_count integer DEFAULT 0 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: monitor_event_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.monitor_event_posts (
    event_id text NOT NULL,
    post_id text NOT NULL,
    stage text NOT NULL,
    action text,
    text text NOT NULL,
    original_text text NOT NULL
);


--
-- Name: monitor_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.monitor_events (
    id text NOT NULL,
    type text NOT NULL,
    status text NOT NULL,
    title text NOT NULL,
    scope text DEFAULT ''::text NOT NULL,
    schedule jsonb,
    estimate jsonb,
    presentation jsonb,
    confirmed_at timestamp with time zone,
    occurred_on date,
    confirmation_basis text,
    withdrawn boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    label text DEFAULT ''::text NOT NULL,
    display_label text DEFAULT ''::text NOT NULL,
    CONSTRAINT monitor_events_confirmation_basis_check CHECK ((confirmation_basis = ANY (ARRAY['source_post'::text, 'receipt_review'::text]))),
    CONSTRAINT monitor_events_status_check CHECK ((status = ANY (ARRAY['announced'::text, 'confirmed'::text]))),
    CONSTRAINT monitor_events_type_check CHECK ((type = ANY (ARRAY['direct_reset'::text, 'reset_credit'::text])))
);


--
-- Name: monitor_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.monitor_posts (
    id text NOT NULL,
    author text NOT NULL,
    published_at timestamp with time zone NOT NULL,
    text text NOT NULL,
    url text NOT NULL,
    context jsonb DEFAULT '[]'::jsonb NOT NULL,
    raw jsonb,
    translation text,
    recognition jsonb,
    receipt_id bigint,
    origin text DEFAULT 'live'::text NOT NULL,
    collected_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    activity jsonb,
    outage jsonb,
    CONSTRAINT monitor_posts_origin_check CHECK ((origin = ANY (ARRAY['live'::text, 'imported'::text])))
);


--
-- Name: monitor_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.monitor_state (
    key text NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lb_rankings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lb_rankings ALTER COLUMN id SET DEFAULT nextval('public.lb_rankings_id_seq'::regclass);


--
-- Name: fx_rates fx_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fx_rates
    ADD CONSTRAINT fx_rates_pkey PRIMARY KEY (as_of, pair);


--
-- Name: lb_aliases lb_aliases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lb_aliases
    ADD CONSTRAINT lb_aliases_pkey PRIMARY KEY (id);


--
-- Name: lb_models lb_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lb_models
    ADD CONSTRAINT lb_models_pkey PRIMARY KEY (id);


--
-- Name: lb_models lb_models_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lb_models
    ADD CONSTRAINT lb_models_slug_key UNIQUE (slug);


--
-- Name: lb_prices lb_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lb_prices
    ADD CONSTRAINT lb_prices_pkey PRIMARY KEY (model_id, kind);


--
-- Name: lb_rankings lb_rankings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lb_rankings
    ADD CONSTRAINT lb_rankings_pkey PRIMARY KEY (id);


--
-- Name: lb_rankings lb_rankings_run_id_board_model_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lb_rankings
    ADD CONSTRAINT lb_rankings_run_id_board_model_id_key UNIQUE (run_id, board, model_id);


--
-- Name: lb_runs lb_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lb_runs
    ADD CONSTRAINT lb_runs_pkey PRIMARY KEY (id);


--
-- Name: lb_scores lb_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lb_scores
    ADD CONSTRAINT lb_scores_pkey PRIMARY KEY (id);


--
-- Name: lb_snapshots lb_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lb_snapshots
    ADD CONSTRAINT lb_snapshots_pkey PRIMARY KEY (id);


--
-- Name: monitor_event_posts monitor_event_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monitor_event_posts
    ADD CONSTRAINT monitor_event_posts_pkey PRIMARY KEY (event_id, post_id);


--
-- Name: monitor_events monitor_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monitor_events
    ADD CONSTRAINT monitor_events_pkey PRIMARY KEY (id);


--
-- Name: monitor_posts monitor_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monitor_posts
    ADD CONSTRAINT monitor_posts_pkey PRIMARY KEY (id);


--
-- Name: monitor_state monitor_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monitor_state
    ADD CONSTRAINT monitor_state_pkey PRIMARY KEY (key);


--
-- Name: lb_aliases_lookup_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lb_aliases_lookup_idx ON public.lb_aliases USING btree (source_key, normalized_alias);


--
-- Name: lb_aliases_source_alias_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX lb_aliases_source_alias_key ON public.lb_aliases USING btree (source_key, alias);


--
-- Name: lb_scores_model_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lb_scores_model_idx ON public.lb_scores USING btree (model_id);


--
-- Name: lb_scores_snapshot_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lb_scores_snapshot_idx ON public.lb_scores USING btree (snapshot_id);


--
-- Name: lb_snapshots_source_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lb_snapshots_source_idx ON public.lb_snapshots USING btree (source_key, fetched_at DESC);


--
-- Name: monitor_event_posts_post_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX monitor_event_posts_post_idx ON public.monitor_event_posts USING btree (post_id);


--
-- Name: monitor_posts_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX monitor_posts_time_idx ON public.monitor_posts USING btree (published_at DESC);


--
-- Name: lb_aliases lb_aliases_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lb_aliases
    ADD CONSTRAINT lb_aliases_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.lb_models(id);


--
-- Name: lb_prices lb_prices_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lb_prices
    ADD CONSTRAINT lb_prices_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.lb_models(id);


--
-- Name: lb_rankings lb_rankings_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lb_rankings
    ADD CONSTRAINT lb_rankings_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.lb_models(id);


--
-- Name: lb_rankings lb_rankings_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lb_rankings
    ADD CONSTRAINT lb_rankings_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.lb_runs(id) ON DELETE CASCADE;


--
-- Name: lb_scores lb_scores_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lb_scores
    ADD CONSTRAINT lb_scores_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.lb_models(id);


--
-- Name: lb_scores lb_scores_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lb_scores
    ADD CONSTRAINT lb_scores_snapshot_id_fkey FOREIGN KEY (snapshot_id) REFERENCES public.lb_snapshots(id) ON DELETE CASCADE;


--
-- Name: monitor_event_posts monitor_event_posts_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monitor_event_posts
    ADD CONSTRAINT monitor_event_posts_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.monitor_events(id) ON DELETE CASCADE;


--
-- Name: monitor_event_posts monitor_event_posts_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monitor_event_posts
    ADD CONSTRAINT monitor_event_posts_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.monitor_posts(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


