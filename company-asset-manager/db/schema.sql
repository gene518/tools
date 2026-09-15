--
-- PostgreSQL database dump
--

\restrict 6gox0gxSFkuPg1Vh8YH9UCaLeIZfs5wxQqblRsfcM2pxMMkH2AzZI5KvpaEwAC3

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: citext; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;


--
-- Name: EXTENSION citext; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION citext IS 'data type for case-insensitive character strings';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id integer NOT NULL,
    username public.citext NOT NULL,
    name text NOT NULL,
    password_hash text NOT NULL,
    role text NOT NULL,
    active integer DEFAULT 1 NOT NULL,
    created_at text DEFAULT to_char((clock_timestamp() AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'::text) NOT NULL,
    CONSTRAINT accounts_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'viewer'::text])))
);


--
-- Name: accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.accounts ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.accounts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assets (
    id integer NOT NULL,
    code public.citext NOT NULL,
    name text NOT NULL,
    category text DEFAULT '笔记本电脑'::text NOT NULL,
    brand text DEFAULT ''::text NOT NULL,
    model text DEFAULT ''::text NOT NULL,
    serial public.citext,
    cpu text DEFAULT ''::text NOT NULL,
    memory text DEFAULT ''::text NOT NULL,
    disk text DEFAULT ''::text NOT NULL,
    source text NOT NULL,
    entry_date text NOT NULL,
    purchase_date text,
    purchase_amount bigint,
    warranty_date text,
    owner_id integer NOT NULL,
    user_id integer,
    status text NOT NULL,
    location text DEFAULT ''::text NOT NULL,
    condition text DEFAULT '完好'::text NOT NULL,
    accessories text DEFAULT ''::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    usage_date text,
    version integer DEFAULT 1 NOT NULL,
    created_at text DEFAULT to_char((clock_timestamp() AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'::text) NOT NULL,
    updated_at text DEFAULT to_char((clock_timestamp() AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'::text) NOT NULL,
    CONSTRAINT assets_check CHECK ((((status = 'in_use'::text) AND (user_id IS NOT NULL)) OR ((status <> 'in_use'::text) AND (user_id IS NULL)))),
    CONSTRAINT assets_purchase_amount_check CHECK (((purchase_amount IS NULL) OR (purchase_amount >= 0))),
    CONSTRAINT assets_source_check CHECK ((source = ANY (ARRAY['existing'::text, 'new'::text]))),
    CONSTRAINT assets_status_check CHECK ((status = ANY (ARRAY['available'::text, 'pending'::text, 'in_use'::text, 'repair'::text, 'retired'::text])))
);


--
-- Name: assets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.assets ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.assets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attachments (
    id integer NOT NULL,
    asset_id integer NOT NULL,
    event_id integer,
    original_name text NOT NULL,
    stored_name text NOT NULL,
    mime text NOT NULL,
    size integer NOT NULL,
    actor_id integer NOT NULL,
    created_at text DEFAULT to_char((clock_timestamp() AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'::text) NOT NULL
);


--
-- Name: attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.attachments ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.attachments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    id integer NOT NULL,
    code public.citext NOT NULL,
    name text NOT NULL,
    department text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at text DEFAULT to_char((clock_timestamp() AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'::text) NOT NULL,
    CONSTRAINT employees_status_check CHECK ((status = ANY (ARRAY['active'::text, 'departed'::text])))
);


--
-- Name: employees_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.employees ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.employees_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id integer NOT NULL,
    asset_id integer,
    entity text NOT NULL,
    action text NOT NULL,
    actor_id integer NOT NULL,
    actor_name text NOT NULL,
    effective_date text,
    before_json text,
    after_json text,
    details_json text DEFAULT '{}'::text NOT NULL,
    created_at text DEFAULT to_char((clock_timestamp() AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'::text) NOT NULL
);


--
-- Name: events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: handovers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.handovers (
    id integer NOT NULL,
    asset_id integer NOT NULL,
    target_id integer NOT NULL,
    target_snapshot text NOT NULL,
    state text NOT NULL,
    effective_date text NOT NULL,
    location text NOT NULL,
    condition text NOT NULL,
    accessories text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    created_by integer NOT NULL,
    created_at text DEFAULT to_char((clock_timestamp() AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'::text) NOT NULL,
    completed_at text,
    CONSTRAINT handovers_state_check CHECK ((state = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancelled'::text])))
);


--
-- Name: handovers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.handovers ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.handovers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: schema_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_versions (
    version integer NOT NULL,
    applied_at text DEFAULT to_char((clock_timestamp() AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'::text) NOT NULL
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    token_hash text NOT NULL,
    account_id integer NOT NULL,
    expires_at bigint NOT NULL
);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: accounts accounts_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_username_key UNIQUE (username);


--
-- Name: assets assets_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_code_key UNIQUE (code);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: assets assets_serial_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_serial_key UNIQUE (serial);


--
-- Name: attachments attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_pkey PRIMARY KEY (id);


--
-- Name: attachments attachments_stored_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_stored_name_key UNIQUE (stored_name);


--
-- Name: employees employees_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_code_key UNIQUE (code);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: handovers handovers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.handovers
    ADD CONSTRAINT handovers_pkey PRIMARY KEY (id);


--
-- Name: schema_versions schema_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_versions
    ADD CONSTRAINT schema_versions_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (token_hash);


--
-- Name: assets_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assets_owner ON public.assets USING btree (owner_id);


--
-- Name: assets_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assets_user ON public.assets USING btree (user_id);


--
-- Name: events_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX events_asset ON public.events USING btree (asset_id, id);


--
-- Name: one_pending_handover; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX one_pending_handover ON public.handovers USING btree (asset_id) WHERE (state = 'pending'::text);


--
-- Name: assets assets_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.employees(id);


--
-- Name: assets assets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.employees(id);


--
-- Name: attachments attachments_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.accounts(id);


--
-- Name: attachments attachments_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id);


--
-- Name: attachments attachments_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id);


--
-- Name: events events_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.accounts(id);


--
-- Name: events events_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id);


--
-- Name: handovers handovers_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.handovers
    ADD CONSTRAINT handovers_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id);


--
-- Name: handovers handovers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.handovers
    ADD CONSTRAINT handovers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.accounts(id);


--
-- Name: handovers handovers_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.handovers
    ADD CONSTRAINT handovers_target_id_fkey FOREIGN KEY (target_id) REFERENCES public.employees(id);


--
-- Name: sessions sessions_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- PostgreSQL database dump complete
--

\unrestrict 6gox0gxSFkuPg1Vh8YH9UCaLeIZfs5wxQqblRsfcM2pxMMkH2AzZI5KvpaEwAC3

