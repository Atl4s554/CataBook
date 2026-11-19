"""Exportação e importação de livros em arquivos CSV (CataBook).

As colunas seguem o modelo de livro do front-end (assets/js/storage.js), então
o mesmo CSV serve para os dados do localStorage de hoje e para o Postgres depois.

Detalhes pensados para abrir bem no Excel brasileiro:
  - separador ';' (padrão do Excel em pt-BR) e codificação UTF-8 com BOM,
    para os acentos não quebrarem;
  - células que começam com = + - @ ganham um apóstrofo, para o Excel não
    executar como fórmula (a importação remove esse apóstrofo de volta).

Uso rápido (a partir da pasta Backend/):
  python csv_export.py                      -> gera um CSV de exemplo (sem internet)
  python csv_export.py 9788535902775 ...    -> consulta os ISBNs na Google Books API
                                               e grava livros_api.csv
"""

import argparse
import csv
import io
from pathlib import Path

COLUNAS = [
    "id",
    "title",
    "isbn",
    "code",
    "quantity",
    "author",
    "genre",
    "year",
    "publisher",
    "status",
    "description",
    "cover_url",
    "created_at",
    "updated_at",
]

# Campos marcados com * no formulário de cadastro (pages/book-form.html).
OBRIGATORIOS = ["title", "isbn", "code", "quantity"]

DELIMITADOR_PADRAO = ";"
ENCODING = "utf-8-sig"  # UTF-8 com BOM: o Excel reconhece os acentos
_INICIO_DE_FORMULA = ("=", "+", "-", "@")


def _proteger(valor) -> str:
    """Converte para texto e neutraliza fórmulas (CSV injection)."""
    texto = "" if valor is None else str(valor)
    if texto.startswith(_INICIO_DE_FORMULA):
        return "'" + texto
    return texto


def _desproteger(texto: str) -> str:
    """Desfaz o apóstrofo colocado por _proteger()."""
    if texto.startswith("'") and texto[1:2] in _INICIO_DE_FORMULA:
        return texto[1:]
    return texto


def _escrever(livros, saida, delimitador: str) -> None:
    writer = csv.DictWriter(
        saida,
        fieldnames=COLUNAS,
        delimiter=delimitador,
        extrasaction="ignore",  # ignora chaves que não são colunas
        lineterminator="\r\n",
    )
    writer.writeheader()
    for livro in livros:
        writer.writerow({col: _proteger(livro.get(col)) for col in COLUNAS})


def livros_para_csv_string(livros: list[dict], delimitador: str = DELIMITADOR_PADRAO) -> str:
    """Devolve o CSV como texto (útil para responder um download numa API)."""
    saida = io.StringIO(newline="")
    _escrever(livros, saida, delimitador)
    return saida.getvalue()


def exportar_livros_csv(livros: list[dict], caminho: str | Path,
                        delimitador: str = DELIMITADOR_PADRAO) -> Path:
    """Grava a lista de livros em um arquivo CSV e devolve o caminho."""
    caminho = Path(caminho)
    caminho.parent.mkdir(parents=True, exist_ok=True)
    with open(caminho, "w", newline="", encoding=ENCODING) as arquivo:
        _escrever(livros, arquivo, delimitador)
    return caminho


def _detectar_delimitador(primeira_linha: str) -> str:
    """Escolhe entre ';', ',' e tab pelo cabeçalho (Excel pt-BR usa ';')."""
    return max([";", ",", "\t"], key=primeira_linha.count)


def _inteiro(texto: str):
    texto = texto.strip()
    if not texto:
        return None
    try:
        return int(float(texto.replace(",", ".")))
    except ValueError:
        return None


def importar_livros_csv(caminho: str | Path,
                        delimitador: str | None = None) -> tuple[list[dict], list[str]]:
    """Lê um CSV de livros.

    Devolve (livros, erros). Linhas com problema vão para `erros` (com o número
    da linha no arquivo) e não entram em `livros`; as demais são importadas.
    """
    livros: list[dict] = []
    erros: list[str] = []

    with open(caminho, newline="", encoding=ENCODING) as arquivo:
        texto = arquivo.read()

    if not texto.strip():
        return livros, ["Arquivo vazio."]

    delimitador = delimitador or _detectar_delimitador(texto.splitlines()[0])
    leitor = csv.DictReader(io.StringIO(texto, newline=""), delimiter=delimitador)

    faltando = [c for c in OBRIGATORIOS if c not in (leitor.fieldnames or [])]
    if faltando:
        return livros, [f"Colunas obrigatórias ausentes no cabeçalho: {', '.join(faltando)}"]

    for linha in leitor:
        n = leitor.line_num  # linha onde o registro termina no arquivo
        livro = {col: _desproteger((linha.get(col) or "").strip()) for col in COLUNAS}

        ausentes = [c for c in ("title", "isbn", "code") if not livro[c]]
        if ausentes:
            erros.append(f"Linha {n}: campo(s) obrigatório(s) vazio(s): {', '.join(ausentes)}")
            continue

        quantidade = _inteiro(livro["quantity"])
        if quantidade is None or quantidade < 1:
            erros.append(f"Linha {n}: 'quantity' deve ser um número inteiro >= 1 "
                         f"(recebido: {livro['quantity']!r})")
            continue

        livro["quantity"] = quantidade
        livro["year"] = _inteiro(livro["year"])
        livro["cover_url"] = livro["cover_url"] or None
        livros.append(livro)

    return livros, erros


def api_para_livro(dados_api: dict, codigo: str, quantidade: int = 1) -> dict:
    """Converte o dict de googleBooks.buscar_livro_por_isbn() em um livro do projeto.

    A API não informa o código interno nem a quantidade em estoque, então eles
    são preenchidos aqui; o resto (isbn, title, author, publisher, year, genre,
    description, cover_url) vem direto da API.
    """
    return {**dados_api, "code": codigo, "quantity": quantidade}


def exportar_isbns_csv(isbns: list[str], caminho: str | Path,
                       delimitador: str = DELIMITADOR_PADRAO,
                       quantidade: int = 1,
                       prefixo_codigo: str | None = "LIV-") -> tuple[Path | None, list[str]]:
    """Consulta cada ISBN na Google Books API e grava os livros em um CSV.

    Devolve (caminho, erros). Um ISBN não encontrado ou com falha na API não
    derruba os demais: ele entra em `erros` e a lista continua. Se nenhum livro
    for encontrado, nenhum arquivo é criado e `caminho` vem como None.

    Os códigos internos são gerados em sequência (LIV-001, LIV-002, ...). Passe
    prefixo_codigo=None para deixar a coluna 'code' vazia.
    """
    # Import aqui dentro: só quem usa a API precisa de requests/python-dotenv.
    import requests
    from googleBooks import buscar_livro_por_isbn, limpar_isbn

    livros: list[dict] = []
    erros: list[str] = []
    vistos: set[str] = set()

    for isbn in isbns:
        limpo = limpar_isbn(isbn)
        if not limpo or limpo in vistos:
            continue
        vistos.add(limpo)

        # Nas mensagens de erro nunca vai o texto da exceção: o do requests
        # inclui a URL completa, e a URL leva a chave da API.
        try:
            dados = buscar_livro_por_isbn(limpo)
        except requests.HTTPError as erro:
            status = erro.response.status_code if erro.response is not None else "?"
            erros.append(f"ISBN {limpo}: a API respondeu com erro HTTP {status}")
            continue
        except (requests.RequestException, ValueError) as erro:
            erros.append(f"ISBN {limpo}: falha ao consultar a API ({type(erro).__name__})")
            continue

        if dados is None:
            erros.append(f"ISBN {limpo}: não encontrado no Google Books")
            continue

        codigo = f"{prefixo_codigo}{len(livros) + 1:03d}" if prefixo_codigo else ""
        livros.append(api_para_livro(dados, codigo, quantidade))

    if not livros:
        return None, erros
    return exportar_livros_csv(livros, caminho, delimitador), erros


def _demo() -> None:
    """Gera um CSV de exemplo (sem internet) e lê de volta."""
    exemplo = [
        {
            "id": "1", "title": "Dom Casmurro", "isbn": "9788535902775",
            "code": "LIV-001", "quantity": 2, "author": "Machado de Assis",
            "genre": "Romance", "year": 1899, "publisher": "Companhia das Letras",
            "status": "Disponível",
            "description": "Bentinho, Capitu e a dúvida; um clássico.",
            "cover_url": None,
            "created_at": "2026-11-14T16:00:00Z", "updated_at": "2026-11-14T16:00:00Z",
        },
        {
            "id": "2", "title": "O Cortiço", "isbn": "9788508040827",
            "code": "LIV-002", "quantity": 1, "author": "Aluísio Azevedo",
            "genre": "Romance, Naturalismo", "year": 1890, "publisher": "Ática",
            "status": "Disponível", "description": "", "cover_url": None,
            "created_at": "2026-11-14T16:00:00Z", "updated_at": "2026-11-14T16:00:00Z",
        },
    ]

    destino = Path(__file__).parent / "livros_exemplo.csv"
    exportar_livros_csv(exemplo, destino)
    print(f"CSV gerado em: {destino}")

    lidos, problemas = importar_livros_csv(destino)
    print(f"{len(lidos)} livro(s) lido(s), {len(problemas)} erro(s)")
    for livro in lidos:
        print(" -", livro["code"], livro["title"])


def _principal() -> None:
    parser = argparse.ArgumentParser(
        description="Gera um CSV de livros a partir de ISBNs (Google Books API).")
    parser.add_argument("isbns", nargs="*",
                        help="ISBNs a consultar. Sem nenhum, gera um CSV de exemplo.")
    parser.add_argument("-o", "--saida", default="livros_api.csv",
                        help="arquivo CSV de saída (padrão: livros_api.csv)")
    args = parser.parse_args()

    if not args.isbns:
        _demo()
        return

    caminho, erros = exportar_isbns_csv(args.isbns, args.saida)
    for erro in erros:
        print("Aviso:", erro)
    if caminho:
        print(f"CSV gerado em: {Path(caminho).resolve()}")
    else:
        print("Nenhum livro encontrado; nenhum arquivo foi criado.")


if __name__ == "__main__":
    _principal()
