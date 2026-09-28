const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors'); // Permette al frontend di comunicare col server
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors()); // Abilita CORS

// Connessione al database SQLite
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('Errore di connessione al database', err.message);
    } else {
        console.log('Connesso al database SQLite.');
        creaTabelle();
    }
});

// Creazione delle tabelle iniziali e inserimento dati di prova se vuote
function creaTabelle() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS magazzini (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS giacenze (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            magazzino_id INTEGER,
            prodotto TEXT NOT NULL,
            modello TEXT NOT NULL,
            quantita INTEGER DEFAULT 0,
            FOREIGN KEY(magazzino_id) REFERENCES magazzini(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS ordini (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            magazzino_id INTEGER,
            fornitore TEXT NOT NULL,
            venditore TEXT NOT NULL,
            acquirente TEXT NOT NULL,
            riferimento_fattura TEXT,
            riferimento_deal TEXT,
            data_ordine TEXT,
            prodotti TEXT NOT NULL,
            stato TEXT DEFAULT 'Preso in carico',
            metodo_spedizione TEXT DEFAULT '',
            confezionamento TEXT DEFAULT '',
            tracking TEXT DEFAULT '',
            FOREIGN KEY(magazzino_id) REFERENCES magazzini(id)
        )`, () => {
            // Inseriamo un magazzino e una giacenza di prova se la tabella è vuota
            db.get("SELECT COUNT(*) as count FROM magazzini", (err, row) => {
                if (row.count === 0) {
                    db.run("INSERT INTO magazzini (nome) VALUES ('Magazzino Centrale Roma')");
                    db.run("INSERT INTO magazzini (nome) VALUES ('Magazzino Nord Milano')");
                    db.run("INSERT INTO giacenze (magazzino_id, prodotto, modello, quantita) VALUES (1, 'Smartphone Fold7', '12GB/512GB', 15)");
                    db.run("INSERT INTO giacenze (magazzino_id, prodotto, modello, quantita) VALUES (2, 'Tablet Pro', '10 inch', 8)");
                }
            });
        });
    });
}

// --- ROTTE API ---

// 1. Visualizza tutte le giacenze
app.get('/api/giacenze', (req, res) => {
    const query = `
        SELECT giacenze.*, magazzini.nome as magazzino_nome 
        FROM giacenze 
        JOIN magazzini ON giacenze.magazzino_id = magazzini.id
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ errore: err.message });
        res.json(rows);
    });
});

// 2. Visualizza tutti gli ordini (con stato e tracking)
app.get('/api/ordini', (req, res) => {
    const query = `
        SELECT ordini.*, magazzini.nome as magazzino_nome 
        FROM ordini 
        JOIN magazzini ON ordini.magazzino_id = magazzini.id
        ORDER BY ordini.id DESC
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ errore: err.message });
        res.json(rows);
    });
});

// 3. Crea un nuovo ordine
app.post('/api/ordini', (req, res) => {
    const { magazzino_id, fornitore, venditore, acquirente, riferimento_fattura, riferimento_deal, data_ordine, prodotti } = req.body;
    
    const query = `INSERT INTO ordini (magazzino_id, fornitore, venditore, acquirente, riferimento_fattura, riferimento_deal, data_ordine, prodotti, stato) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Preso in carico')`;
    
    db.run(query, [magazzino_id, fornitore, venditore, acquirente, riferimento_fattura, riferimento_deal, data_ordine, prodotti], function(err) {
        if (err) return res.status(500).json({ errore: err.message });
        res.json({ id_ordine: this.lastID, messaggio: 'Ordine creato con successo! Notifica visiva attivata.' });
    });
});

// 4. Aggiorna lo stato e i dati di spedizione dell'ordine
app.put('/api/ordini/:id/stato', (req, res) => {
    const { stato, metodo_spedizione, confezionamento, tracking } = req.body;
    const ordineId = req.params.id;

    const query = `UPDATE ordini SET stato = ?, metodo_spedizione = ?, confezionamento = ?, tracking = ? WHERE id = ?`;
    
    db.run(query, [stato, metodo_spedizione || '', confezionamento || '', tracking || '', ordineId], function(err) {
        if (err) return res.status(500).json({ errore: err.message });
        res.json({ messaggio: `Stato dell'ordine aggiornato a: ${stato}` });
    });
});

app.listen(PORT, () => {
    console.log(`Server avviato sulla porta ${PORT}`);
});
