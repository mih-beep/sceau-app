--
-- PostgreSQL database dump
--

\restrict qlae0Y6cqpcpEL2wbge2LeMGdvkKecjaD8ibJRwRes4k6Utn4gZ6aRE8jo74XQw

-- Dumped from database version 17.11 (Debian 17.11-0+deb13u1)
-- Dumped by pg_dump version 17.11 (Debian 17.11-0+deb13u1)

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: seals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.seals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hash bytea NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    author_id uuid NOT NULL,
    title text,
    category text DEFAULT 'Art'::text,
    is_public boolean DEFAULT true,
    is_hosted boolean DEFAULT false,
    file_path text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    description text
);


ALTER TABLE public.seals OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    handle text NOT NULL,
    pubkey bytea NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Data for Name: seals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.seals (id, hash, "timestamp", author_id, title, category, is_public, is_hosted, file_path, created_at, description) FROM stdin;
78878220-7686-4d26-a160-4a5a58f8791a	\\x94593f7ab28190cc25c1df7537e27837f1ac21ea36780ac1a8a5800a82dd8a6c	2026-11-05 07:27:58.911+00	06d18ebb-15db-4473-9bf4-33e677a08c52	arn	Art	t	f	\N	2026-11-05 07:27:58.944958+00	\N
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, handle, pubkey, created_at) FROM stdin;
06d18ebb-15db-4473-9bf4-33e677a08c52	arnaud	\\x4009f5ddda3fbcc365a0338d6cf95ce3312f5ce9c61502de70a3d661530af020	2026-11-05 07:27:33.479227+00
\.


--
-- Name: seals seals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seals
    ADD CONSTRAINT seals_pkey PRIMARY KEY (id);


--
-- Name: seals unique_seal; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seals
    ADD CONSTRAINT unique_seal UNIQUE (hash, author_id);


--
-- Name: users users_handle_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_handle_key UNIQUE (handle);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: seals seals_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seals
    ADD CONSTRAINT seals_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict qlae0Y6cqpcpEL2wbge2LeMGdvkKecjaD8ibJRwRes4k6Utn4gZ6aRE8jo74XQw

