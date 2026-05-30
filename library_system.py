import json
import os
import time
import uuid


# region agent log
LOG_PATH = "debug-150520.log"
SESSION_ID = "150520"


def debug_log(run_id, hypothesis_id, location, message, data):
    payload = {
        "sessionId": SESSION_ID,
        "runId": run_id,
        "hypothesisId": hypothesis_id,
        "id": f"log_{int(time.time() * 1000)}_{uuid.uuid4().hex[:6]}",
        "location": location,
        "message": message,
        "data": data,
        "timestamp": int(time.time() * 1000),
    }
    try:
        with open(LOG_PATH, "a", encoding="utf-8") as log_file:
            log_file.write(json.dumps(payload, ensure_ascii=False) + "\n")
    except OSError:
        pass


# endregion


class Book:
    def __init__(self, book_id, title, author, year, genre, status="в наличии"):
        self.id = book_id
        self.title = title
        self.author = author
        self.year = year
        self.genre = genre
        self.status = status

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "author": self.author,
            "year": self.year,
            "genre": self.genre,
            "status": self.status,
        }

    @staticmethod
    def from_dict(data):
        return Book(
            data["id"],
            data["title"],
            data["author"],
            data["year"],
            data["genre"],
            data.get("status", "в наличии"),
        )


class Library:
    def __init__(self, storage_file="books.json"):
        self.storage_file = storage_file
        self.books = []
        self.next_id = 1
        self.load_books()

    def load_books(self):
        if not os.path.exists(self.storage_file):
            self.books = []
            self.next_id = 1
            debug_log(
                "run1",
                "H1",
                "library_system.py:load_books",
                "Storage file not found, initialized empty library",
                {"storageFile": self.storage_file},
            )
            return

        try:
            with open(self.storage_file, "r", encoding="utf-8") as file:
                data = json.load(file)
            self.books = [Book.from_dict(item) for item in data]
            self.next_id = (max((book.id for book in self.books), default=0) + 1)
            debug_log(
                "run1",
                "H1",
                "library_system.py:load_books",
                "Loaded books from storage",
                {"count": len(self.books), "nextId": self.next_id},
            )
        except (json.JSONDecodeError, OSError, KeyError, TypeError) as error:
            self.books = []
            self.next_id = 1
            debug_log(
                "run1",
                "H1",
                "library_system.py:load_books",
                "Failed to load storage, fallback to empty",
                {"error": str(error)},
            )

    def save_books(self):
        with open(self.storage_file, "w", encoding="utf-8") as file:
            json.dump([book.to_dict() for book in self.books], file, ensure_ascii=False, indent=2)
        debug_log(
            "run1",
            "H2",
            "library_system.py:save_books",
            "Saved books to storage",
            {"count": len(self.books)},
        )

    def add_book(self, title, author, year, genre, status="в наличии"):
        book = Book(self.next_id, title, author, year, genre, status)
        self.books.append(book)
        self.next_id += 1
        self.save_books()
        debug_log(
            "run1",
            "H2",
            "library_system.py:add_book",
            "Book added",
            {"bookId": book.id, "title": book.title},
        )
        return book

    def view_books(self):
        return self.books

    def search_books(self, query):
        query_lower = query.lower()
        results = [
            book
            for book in self.books
            if query_lower in book.title.lower() or query_lower in book.author.lower()
        ]
        debug_log(
            "run1",
            "H3",
            "library_system.py:search_books",
            "Search executed",
            {"query": query, "resultCount": len(results)},
        )
        return results

    def get_book_by_id(self, book_id):
        for book in self.books:
            if book.id == book_id:
                return book
        return None

    def delete_book(self, book_id):
        book = self.get_book_by_id(book_id)
        if not book:
            debug_log(
                "run1",
                "H4",
                "library_system.py:delete_book",
                "Delete failed, book not found",
                {"bookId": book_id},
            )
            return False
        self.books.remove(book)
        self.save_books()
        debug_log(
            "run1",
            "H4",
            "library_system.py:delete_book",
            "Book deleted",
            {"bookId": book_id},
        )
        return True

    def edit_book(self, book_id, title=None, author=None, year=None, genre=None, status=None):
        book = self.get_book_by_id(book_id)
        if not book:
            debug_log(
                "run1",
                "H5",
                "library_system.py:edit_book",
                "Edit failed, book not found",
                {"bookId": book_id},
            )
            return False

        if title:
            book.title = title
        if author:
            book.author = author
        if year:
            book.year = year
        if genre:
            book.genre = genre
        if status:
            book.status = status
        self.save_books()
        debug_log(
            "run1",
            "H5",
            "library_system.py:edit_book",
            "Book edited",
            {"bookId": book_id, "status": book.status},
        )
        return True


def print_books(books):
    if not books:
        print("\nСписок книг пуст.\n")
        return
    print("\nСписок книг:")
    print("-" * 82)
    print(f"{'ID':<5}{'Название':<25}{'Автор':<20}{'Год':<8}{'Жанр':<12}{'Статус':<12}")
    print("-" * 82)
    for book in books:
        print(
            f"{book.id:<5}{book.title[:23]:<25}{book.author[:18]:<20}{book.year:<8}{book.genre[:10]:<12}{book.status:<12}"
        )
    print("-" * 82 + "\n")


def read_int(prompt):
    try:
        return int(input(prompt).strip())
    except ValueError:
        return None


def main():
    library = Library()

    while True:
        print("=== Система управления библиотекой ===")
        print("1. Добавить книгу")
        print("2. Показать все книги")
        print("3. Найти книгу (по названию или автору)")
        print("4. Удалить книгу")
        print("5. Редактировать книгу")
        print("6. Выход")
        choice = input("Выберите действие: ").strip()

        if choice == "1":
            title = input("Название: ").strip()
            author = input("Автор: ").strip()
            year = read_int("Год издания: ")
            genre = input("Жанр: ").strip()
            status = input("Статус (в наличии/выдана) [по умолчанию: в наличии]: ").strip() or "в наличии"

            if not title or not author or year is None or not genre:
                print("Ошибка: заполните все поля корректно.\n")
                continue
            if status not in ("в наличии", "выдана"):
                print("Ошибка: статус должен быть 'в наличии' или 'выдана'.\n")
                continue

            book = library.add_book(title, author, year, genre, status)
            print(f"Книга добавлена. ID: {book.id}\n")

        elif choice == "2":
            print_books(library.view_books())

        elif choice == "3":
            query = input("Введите название или автора для поиска: ").strip()
            if not query:
                print("Ошибка: строка поиска не должна быть пустой.\n")
                continue
            print_books(library.search_books(query))

        elif choice == "4":
            book_id = read_int("Введите ID книги для удаления: ")
            if book_id is None:
                print("Ошибка: ID должен быть числом.\n")
                continue
            if library.delete_book(book_id):
                print("Книга удалена.\n")
            else:
                print("Ошибка: книга с таким ID не найдена.\n")

        elif choice == "5":
            book_id = read_int("Введите ID книги для редактирования: ")
            if book_id is None:
                print("Ошибка: ID должен быть числом.\n")
                continue

            book = library.get_book_by_id(book_id)
            if not book:
                print("Ошибка: книга с таким ID не найдена.\n")
                continue

            print("Оставьте поле пустым, чтобы не изменять значение.")
            title = input(f"Название [{book.title}]: ").strip()
            author = input(f"Автор [{book.author}]: ").strip()
            year_raw = input(f"Год издания [{book.year}]: ").strip()
            genre = input(f"Жанр [{book.genre}]: ").strip()
            status = input(f"Статус ({book.status}) [в наличии/выдана]: ").strip()

            year = None
            if year_raw:
                try:
                    year = int(year_raw)
                except ValueError:
                    print("Ошибка: год должен быть числом.\n")
                    continue

            if status and status not in ("в наличии", "выдана"):
                print("Ошибка: статус должен быть 'в наличии' или 'выдана'.\n")
                continue

            library.edit_book(
                book_id,
                title=title or None,
                author=author or None,
                year=year,
                genre=genre or None,
                status=status or None,
            )
            print("Книга обновлена.\n")

        elif choice == "6":
            print("Выход из программы.")
            break

        else:
            print("Ошибка: выберите пункт от 1 до 6.\n")


if __name__ == "__main__":
    main()
