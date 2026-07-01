-- Blog posts pour le référencement SEO local
CREATE TABLE blog_posts (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  slug          TEXT        NOT NULL UNIQUE,
  titre         TEXT        NOT NULL,
  meta_titre    TEXT        NOT NULL,
  meta_desc     TEXT        NOT NULL,
  intro         TEXT        NOT NULL,
  paragraphes   JSONB       NOT NULL DEFAULT '[]', -- [{titre, texte}] × 6
  conclusion    TEXT        NOT NULL,
  faq           JSONB       NOT NULL DEFAULT '[]', -- [{question, reponse}] × 10
  mots_cles     TEXT[]      DEFAULT '{}',
  categorie     TEXT,
  sujet_id      TEXT        UNIQUE, -- pour ne pas régénérer le même sujet
  statut        TEXT        DEFAULT 'publie' CHECK (statut IN ('brouillon', 'publie')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  published_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX idx_blog_posts_statut ON blog_posts(statut);
CREATE INDEX idx_blog_posts_published ON blog_posts(published_at DESC) WHERE statut = 'publie';

-- Lecture publique pour le site
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blog_publie_read" ON blog_posts FOR SELECT USING (statut = 'publie');
CREATE POLICY "admin_all" ON blog_posts FOR ALL USING (auth.role() = 'service_role');
