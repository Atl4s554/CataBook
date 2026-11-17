"""Acesso ao banco Postgres do CataBook."""

import os
from pathlib import Path

import psycopg
from psycopg.rows import dict_row
from dotenv import load_dotenv

load_dotenv()

# Colunas que podem ser gravadas (id e datas são controlados pelo banco).
CAMPOS = [
    "title", "isbn", "code", "quantity", "author", "genre",
    "year", "publisher", "status", "description", "cover_url",
]

SCHEMA = """
CREATE TABLE IF NOT EXISTS books (
    id          SERIAL PRIMARY KEY,
    title       TEXT NOT NULL,
    isbn        TEXT NOT NULL UNIQUE,
    code        TEXT NOT NULL UNIQUE,
    quantity    INTEGER NOT NULL CHECK (quantity >= 1),
    author      TEXT,
    genre       TEXT,
    year        INTEGER,
    publisher   TEXT,
    status      TEXT NOT NULL DEFAULT 'Disponível',
    description TEXT,
    cover_url   TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""


def conectar() -> psycopg.Connection:
    """Abre uma conexão. Use com 'with conectar() as conn:' (fecha sozinho)."""
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL não definida no .env")
    return psycopg.connect(url, row_factory=dict_row)


def criar_tabelas() -> None:
    with conectar() as conn:
        conn.execute(SCHEMA)


def _so_campos_validos(livro: dict) -> dict:
    return {c: livro.get(c) for c in CAMPOS if c in livro}


def inserir_livro(livro: dict) -> dict:
    dados = _so_campos_validos(livro)
    colunas = ", ".join(dados)
    marcadores = ", ".join(f"%({c})s" for c in dados)
    with conectar() as conn:
        return conn.execute(
            f"INSERT INTO books ({colunas}) VALUES ({marcadores}) RETURNING *",
            dados,
        ).fetchone()


def listar_livros(busca: str | None = None) -> list[dict]:
    with conectar() as conn:
        if busca:
            termo = f"%{busca}%"
            return conn.execute(
                """SELECT * FROM books
                   WHERE title ILIKE %s OR author ILIKE %s
                      OR isbn ILIKE %s OR code ILIKE %s
                   ORDER BY title""",
                (termo, termo, termo, termo),
            ).fetchall()
        return conn.execute("SELECT * FROM books ORDER BY title").fetchall()


def buscar_livro(livro_id: int) -> dict | None:
    with conectar() as conn:
        return conn.execute(
            "SELECT * FROM books WHERE id = %s", (livro_id,)
        ).fetchone()


def atualizar_livro(livro_id: int, livro: dict) -> dict | None:
    dados = _so_campos_validos(livro)
    if not dados:
        return buscar_livro(livro_id)
    # Os nomes das colunas vêm da lista CAMPOS (nunca do usuário): seguro contra SQL injection.
    sets = ", ".join(f"{c} = %({c})s" for c in dados)
    dados["id"] = livro_id
    with conectar() as conn:
        return conn.execute(
            f"UPDATE books SET {sets}, updated_at = now() WHERE id = %(id)s RETURNING *",
            dados,
        ).fetchone()


def remover_livro(livro_id: int) -> bool:
    with conectar() as conn:
        cur = conn.execute("DELETE FROM books WHERE id = %s", (livro_id,))
        return cur.rowcount > 0


def importar_csv(caminho: str | Path) -> tuple[int, list[str]]:
    """Lê um CSV (gerado pelo csv_export.py) e insere no banco.
    Livros com ISBN ou código já existente são pulados. Devolve (inseridos, erros)."""
    from csv_export import importar_livros_csv

    livros, erros = importar_livros_csv(caminho)
    inseridos = 0
    with conectar() as conn:
        for livro in livros:
            dados = _so_campos_validos(livro)
            dados["status"] = dados.get("status") or "Disponível"
            colunas = ", ".join(dados)
            marcadores = ", ".join(f"%({c})s" for c in dados)
            cur = conn.execute(
                f"INSERT INTO books ({colunas}) VALUES ({marcadores}) "
                "ON CONFLICT DO NOTHING",
                dados,
            )
            if cur.rowcount:
                inseridos += 1
            else:
                erros.append(f"{livro['isbn']}: já existe (ISBN ou código repetido)")
    return inseridos, erros


if __name__ == "__main__":
    # Teste rápido: python db.py
    criar_tabelas()
    print("Tabela 'books' pronta. Livros no banco:", len(listar_livros()))


