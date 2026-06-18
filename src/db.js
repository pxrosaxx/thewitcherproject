const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

// Funkcja otwierająca połączenie z plikiem bazy
async function getDbConnection() {
    return open({
        filename: './wiedzmin.sqlite', // Tutaj fizycznie stworzy się plik bazy
        driver: sqlite3.Database
    });
}

module.exports = getDbConnection;