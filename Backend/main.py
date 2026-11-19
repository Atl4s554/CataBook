"""API do CataBook (FastAPI).

Segue o contrato descrito em Remove_DevMode.md, com as respostas de sucesso no
formato que o front (api.js/auth.js) espera: {"success": true, "data": ...}.
  POST   /api/auth/register | /api/auth/login | /api/auth/refresh | /api/auth/logout
  GET    /api/books            (page, limit, sort, q, has_cover)
  GET    /api/books/{id}
  POST   /api/books            (FormData, com capa opcional)
  PUT/PATCH /api/books/{id}    (FormData)
  DELETE /api/books/{id}
Extras que reaproveitam os outros arquivos do Backend:
  GET    /api/isbn/{isbn}      (googleBooks.py)
  GET    /api/books/export/csv (csv_export.py)

Como rodar (a partir da pasta Backend/):
  uvicorn main:app --reload --port 8001
Documentação interativa das rotas: http://localhost:8001/docs
"""

import math
import os
import re
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

import bcrypt
import jwt
import psycopg
import requests
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Query, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException

import db
from csv_export import livros_para_csv_string
from googleBooks import buscar_livro_por_isbn, limpar_isbn

load_dotenv()

# ----------------------------------------------------------------------------
# Configuração (vem do .env)
# ----------------------------------------------------------------------------
JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET não definida no .env")

ALGORITMO = "HS256"
ACCESS_MINUTOS = 30
REFRESH_DIAS = 7

# Endereços do front-end autorizados a chamar a API (CORS).
ORIGENS = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "http://localhost:8000,http://127.0.0.1:8000").split(",")
    if o.strip()
]

PASTA_UPLOADS = Path(__file__).parent / "uploads"
PASTA_UPLOADS.mkdir(exist_ok=True)
TAMANHO_MAX_CAPA = 5 * 1024 * 1024  # 5 MB, igual ao formulário

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.criar_tabelas()  # cria books e users se ainda não existirem
    yield


app = FastAPI(title="CataBook API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGENS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# As capas enviadas ficam em Backend/uploads e são servidas em /uploads/<arquivo>.
app.mount("/uploads", StaticFiles(directory=PASTA_UPLOADS), name="uploads")


# ----------------------------------------------------------------------------
# Erros: o front costuma ler "message", então devolvemos "message" e "detail".
# ----------------------------------------------------------------------------
@app.exception_handler(StarletteHTTPException)
async def erro_http(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        {"message": exc.detail, "detail": exc.detail},
        status_code=exc.status_code,
        headers=getattr(exc, "headers", None),
    )


@app.exception_handler(RequestValidationError)
async def erro_validacao(request: Request, exc: RequestValidationError):
    partes = [
        f"{'.'.join(str(p) for p in e['loc'][1:])}: {e['msg']}" for e in exc.errors()
    ]
    msg = "Dados inválidos: " + "; ".join(partes)
    return JSONResponse({"message": msg, "detail": msg}, status_code=422)


# ----------------------------------------------------------------------------
# Autenticação (JWT + bcrypt)
# ----------------------------------------------------------------------------
def _criar_token(usuario_id: int, tipo: str, validade: timedelta) -> str:
    agora = datetime.now(timezone.utc)
    return jwt.encode(
        {"sub": str(usuario_id), "type": tipo, "iat": agora, "exp": agora + validade},
        JWT_SECRET,
        algorithm=ALGORITMO,
    )


def _ler_token(token: str, tipo: str) -> dict:
    try:
        dados = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITMO])
    except jwt.PyJWTError:
        raise HTTPException(401, "Token inválido ou expirado")
    if dados.get("type") != tipo:
        raise HTTPException(401, "Token inválido")
    return dados


def _gerar_hash(senha: str) -> str:
    return bcrypt.hashpw(senha.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _senha_confere(senha: str, senha_hash: str) -> bool:
    try:
        return bcrypt.checkpw(senha.encode("utf-8"), senha_hash.encode("utf-8"))
    except ValueError:
        return False


def _usuario_publico(usuario: dict) -> dict:
    return {k: usuario[k] for k in ("id", "name", "email", "role")}


def _resposta_auth(usuario: dict) -> dict:
    return {
        "accessToken": _criar_token(usuario["id"], "access", timedelta(minutes=ACCESS_MINUTOS)),
        "refreshToken": _criar_token(usuario["id"], "refresh", timedelta(days=REFRESH_DIAS)),
        "user": _usuario_publico(usuario),
    }


_bearer = HTTPBearer(auto_error=False)


def usuario_atual(credenciais: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> dict:
    """Dependência das rotas protegidas: exige 'Authorization: Bearer <accessToken>'."""
    if credenciais is None:
        raise HTTPException(401, "Não autenticado")
    dados = _ler_token(credenciais.credentials, "access")
    usuario = db.buscar_usuario_por_id(int(dados["sub"]))
    if usuario is None:
        raise HTTPException(401, "Usuário não encontrado")
    return usuario


class LoginIn(BaseModel):
    email: str
    password: str


class RegisterIn(BaseModel):
    email: str
    password: str
    name: str = ""


class RefreshIn(BaseModel):
    refreshToken: str | None = None


@app.post("/api/auth/register", status_code=201)
def registrar(dados: RegisterIn):
    email = dados.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(422, "Email inválido")
    if len(dados.password) < 6:
        raise HTTPException(422, "A senha deve ter pelo menos 6 caracteres")
    if len(dados.password.encode("utf-8")) > 72:  # limite do bcrypt
        raise HTTPException(422, "A senha deve ter no máximo 72 bytes")

    nome = dados.name.strip() or email.split("@")[0]
    try:
        usuario = db.criar_usuario(nome, email, _gerar_hash(dados.password))
    except psycopg.errors.UniqueViolation:
        raise HTTPException(409, "Este email já está cadastrado")
    return {"success": True, "data": _resposta_auth(usuario)}


@app.post("/api/auth/login")
def entrar(dados: LoginIn):
    usuario = db.buscar_usuario_por_email(dados.email.strip().lower())
    if usuario is None or not _senha_confere(dados.password, usuario["password_hash"]):
        raise HTTPException(401, "Email ou senha inválidos")
    return {"success": True, "data": _resposta_auth(usuario)}


@app.post("/api/auth/refresh")
def renovar(dados: RefreshIn | None = None, authorization: str | None = Header(None)):
    """Aceita o refreshToken no corpo JSON ou no header Authorization: Bearer."""
    token = dados.refreshToken if dados and dados.refreshToken else None
    if not token and authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    if not token:
        raise HTTPException(401, "Refresh token ausente")

    payload = _ler_token(token, "refresh")
    usuario = db.buscar_usuario_por_id(int(payload["sub"]))
    if usuario is None:
        raise HTTPException(401, "Usuário não encontrado")
    novo = _criar_token(usuario["id"], "access", timedelta(minutes=ACCESS_MINUTOS))
    return {"success": True, "data": {"accessToken": novo}}


@app.post("/api/auth/logout")
def sair():
    # Os tokens são stateless: o front só precisa descartá-los.
    return {"success": True}


# ----------------------------------------------------------------------------
# Auxiliares dos livros
# ----------------------------------------------------------------------------
def _texto(valor: str | None) -> str | None:
    """Texto aparado; vazio vira None (NULL no banco)."""
    if valor is None:
        return None
    valor = valor.strip()
    return valor or None


def _quantidade(valor: str | None) -> int:
    try:
        n = int(str(valor).strip())
    except (TypeError, ValueError):
        raise HTTPException(422, "Quantidade inválida")
    if not 1 <= n <= 9999:
        raise HTTPException(422, "A quantidade deve estar entre 1 e 9999")
    return n


def _ano(valor: str | None) -> int | None:
    if valor is None or not valor.strip():
        return None
    try:
        ano = int(valor.strip())
    except ValueError:
        raise HTTPException(422, "Ano de publicação inválido")
    if not 1000 <= ano <= 2099:
        raise HTTPException(422, "O ano deve estar entre 1000 e 2099")
    return ano


def _extensao_da_imagem(dados: bytes) -> str | None:
    """Identifica o tipo pelo conteúdo do arquivo (não confia no nome nem no Content-Type)."""
    if dados.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if dados.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if dados[:4] == b"RIFF" and dados[8:12] == b"WEBP":
        return ".webp"
    return None


def _salvar_capa(arquivo: UploadFile) -> str:
    dados = arquivo.file.read(TAMANHO_MAX_CAPA + 1)
    if len(dados) > TAMANHO_MAX_CAPA:
        raise HTTPException(413, "A capa deve ter no máximo 5MB")
    extensao = _extensao_da_imagem(dados)
    if extensao is None:
        raise HTTPException(422, "A capa deve ser JPG, PNG ou WebP")
    nome = f"{uuid.uuid4().hex}{extensao}"
    (PASTA_UPLOADS / nome).write_bytes(dados)
    return f"/uploads/{nome}"


def _apagar_capa(cover_url: str | None) -> None:
    if cover_url and cover_url.startswith("/uploads/"):
        (PASTA_UPLOADS / Path(cover_url).name).unlink(missing_ok=True)


def _livro_json(livro: dict, request: Request) -> dict:
    """Capas locais viram URL completa, porque o front roda em outra porta."""
    livro = dict(livro)
    url = livro.get("cover_url") or ""
    if url.startswith("/uploads/"):
        livro["cover_url"] = str(request.base_url).rstrip("/") + url
    return livro


# ----------------------------------------------------------------------------
# Livros
# ----------------------------------------------------------------------------
@app.get("/api/books")
def listar_livros(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    sort: str = "created_at:desc",
    q: str | None = None,
    has_cover: bool = False,
    _usuario: dict = Depends(usuario_atual),
):
    campo, _sep, direcao = sort.partition(":")
    livros, total = db.listar_livros_paginado(
        busca=(q or "").strip() or None,
        ordenar=campo,
        direcao=direcao,
        apenas_com_capa=has_cover,
        pagina=page,
        limite=limit,
    )
    return {
        "success": True,
        "data": {
            "books": [_livro_json(l, request) for l in livros],
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "totalPages": max(1, math.ceil(total / limit)),
            },
        },
    }


@app.get("/api/books/export/csv")
def exportar_csv(_usuario: dict = Depends(usuario_atual)):
    texto = livros_para_csv_string(db.listar_livros())
    return Response(
        content=("\ufeff" + texto).encode("utf-8"),  # BOM: o Excel reconhece os acentos
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="livros.csv"'},
    )


@app.get("/api/books/{livro_id}")
def obter_livro(livro_id: int, request: Request, _usuario: dict = Depends(usuario_atual)):
    livro = db.buscar_livro(livro_id)
    if livro is None:
        raise HTTPException(404, "Livro não encontrado")
    return {"success": True, "data": _livro_json(livro, request)}


@app.post("/api/books", status_code=201)
def criar_livro(
    request: Request,
    title: str = Form(...),
    isbn: str = Form(...),
    code: str = Form(...),
    quantity: str = Form(...),
    author: str | None = Form(None),
    genre: str | None = Form(None),
    year: str | None = Form(None),
    publisher: str | None = Form(None),
    description: str | None = Form(None),
    cover: UploadFile | None = File(None),
    _usuario: dict = Depends(usuario_atual),
):
    livro = {
        "title": title.strip(),
        "isbn": limpar_isbn(isbn),
        "code": code.strip(),
        "quantity": _quantidade(quantity),
        "author": _texto(author),
        "genre": _texto(genre),
        "year": _ano(year),
        "publisher": _texto(publisher),
        "description": _texto(description),
    }
    for campo in ("title", "isbn", "code"):
        if not livro[campo]:
            raise HTTPException(422, f"Campo obrigatório: {campo}")

    nova_capa = None
    if cover is not None and cover.filename:
        nova_capa = _salvar_capa(cover)
        livro["cover_url"] = nova_capa

    try:
        criado = db.inserir_livro(livro)
    except psycopg.errors.UniqueViolation:
        _apagar_capa(nova_capa)
        raise HTTPException(409, "Já existe um livro com esse ISBN ou código interno")
    return {"success": True, "data": {"book": _livro_json(criado, request)}}


@app.api_route("/api/books/{livro_id}", methods=["PUT", "PATCH", "POST"])
def atualizar_livro(
    livro_id: int,
    request: Request,
    title: str | None = Form(None),
    isbn: str | None = Form(None),
    code: str | None = Form(None),
    quantity: str | None = Form(None),
    author: str | None = Form(None),
    genre: str | None = Form(None),
    year: str | None = Form(None),
    publisher: str | None = Form(None),
    description: str | None = Form(None),
    cover: UploadFile | None = File(None),
    _usuario: dict = Depends(usuario_atual),
):
    """Só altera os campos enviados. Campo opcional enviado vazio vira NULL."""
    atual = db.buscar_livro(livro_id)
    if atual is None:
        raise HTTPException(404, "Livro não encontrado")

    dados: dict = {}
    for campo, valor in (("title", title), ("code", code)):
        if valor is not None:
            if not valor.strip():
                raise HTTPException(422, f"Campo obrigatório: {campo}")
            dados[campo] = valor.strip()
    if isbn is not None:
        limpo = limpar_isbn(isbn)
        if not limpo:
            raise HTTPException(422, "Campo obrigatório: isbn")
        dados["isbn"] = limpo
    if quantity is not None:
        dados["quantity"] = _quantidade(quantity)
    for campo, valor in (("author", author), ("genre", genre),
                         ("publisher", publisher), ("description", description)):
        if valor is not None:
            dados[campo] = _texto(valor)
    if year is not None:
        dados["year"] = _ano(year)

    nova_capa = None
    if cover is not None and cover.filename:
        nova_capa = _salvar_capa(cover)
        dados["cover_url"] = nova_capa

    try:
        atualizado = db.atualizar_livro(livro_id, dados)
    except psycopg.errors.UniqueViolation:
        _apagar_capa(nova_capa)
        raise HTTPException(409, "Já existe um livro com esse ISBN ou código interno")
    if atualizado is None:
        _apagar_capa(nova_capa)
        raise HTTPException(404, "Livro não encontrado")

    if nova_capa:
        _apagar_capa(atual.get("cover_url"))  # remove a capa antiga
    return {"success": True, "data": {"book": _livro_json(atualizado, request)}}


@app.delete("/api/books/{livro_id}")
def remover_livro(livro_id: int, _usuario: dict = Depends(usuario_atual)):
    livro = db.buscar_livro(livro_id)
    if livro is None:
        raise HTTPException(404, "Livro não encontrado")
    db.remover_livro(livro_id)
    _apagar_capa(livro.get("cover_url"))
    return {"success": True, "message": "Livro removido com sucesso"}


# ----------------------------------------------------------------------------
# Consulta de ISBN no Google Books (para preencher o formulário automaticamente)
# ----------------------------------------------------------------------------
@app.get("/api/isbn/{isbn}")
def consultar_isbn(isbn: str, _usuario: dict = Depends(usuario_atual)):
    try:
        dados = buscar_livro_por_isbn(isbn)
    except requests.RequestException:
        # Não repassamos o texto do erro: ele inclui a URL, que leva a chave da API.
        raise HTTPException(502, "Não foi possível consultar o Google Books agora")
    if dados is None:
        raise HTTPException(404, "ISBN não encontrado no Google Books")
    return {"success": True, "data": {"book": dados}}


@app.get("/api/health")
def saude():
    return {"status": "ok"}
