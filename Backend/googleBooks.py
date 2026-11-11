import requests

GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes"

def limpar_isbn(isbn: str) -> str:
    """Remove hífens e espaços: '978-85-359-0277-5' -> '9788535902775'."""
    return isbn.replace("-", "").replace(" ", "").strip()


def buscar_livro_por_isbn(isbn: str) -> dict | None:
    """Consulta a Google Books API e devolve os dados do livro.
    Retorna None se o ISBN não for encontrado."""
    isbn = limpar_isbn(isbn)

    resposta = requests.get(
        GOOGLE_BOOKS_URL,
        params={"q": f"isbn:{isbn}"},
        timeout=10,
    )
    resposta.raise_for_status()  # lança erro se a API responder 4xx/5xx
    dados = resposta.json()

    if dados.get("totalItems", 0) == 0:
        return None

    info = dados["items"][0]["volumeInfo"]

    return {
        "isbn": isbn,
        "title": info.get("title", ""),
        "author": ", ".join(info.get("authors", [])),
        "publisher": info.get("publisher", ""),
        "year": info.get("publishedDate", "")[:4],  # '2008-05-01' -> '2008'
        "genre": ", ".join(info.get("categories", [])),
        "description": info.get("description", ""),
        "cover_url": info.get("imageLinks", {})
        .get("thumbnail", "")
        .replace("http://", "https://"),
    }


if __name__ == "__main__":
    # Teste rápido: python google_books.py
    print(buscar_livro_por_isbn("9788535902775"))