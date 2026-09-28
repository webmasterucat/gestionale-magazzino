const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware per leggere i dati in formato JSON
app.use(express.json());

// Connessione al database SQLite (crea il file database.sqlite in automatico)
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('Errore di connessione al database', err.message);
    } else {
        console.log('Connesso al database SQLite.');
        creaTabelle();
    }
});

// Creazione delle tabelle iniziali
function creaTabelle() {
    db.serialize(() => {
        // Tabella Magazzini
        db.run(`CREATE TABLE IF NOT EXISTS magazzini (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL
        )`);

        // Tabella Giacenze (Prodotti per magazzino)
        db.run(`CREATE TABLE IF NOT EXISTS giacenze (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            magazzino_id INTEGER,
            prodotto TEXT NOT NULL,
            modello TEXT NOT NULL,
            quantita INTEGER DEFAULT 0,
            FOREIGN KEY(magazzino_id) REFERENCES magazzini(id)
        )`);

        // Tabella Ordini
        db.run(`CREATE TABLE IF NOT EXISTS ordini (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            magazzino_id INTEGER,
            fornitore TEXT NOT NULL,
            venditore TEXT NOT NULL,
            acquirente TEXT NOT NULL,
            riferimento_fattura TEXT,
            riferimento_deal TEXT,
            data_ordine TEXT,
            prodotti TEXT NOT NULL, -- JSON o stringa con i prodotti ordinati
            stato TEXT DEFAULT 'Preso in carico',
            metodo_spedizione TEXT,
            confezionamento TEXT,
            tracking TEXT,
            FOREIGN KEY(magazzino_id) REFERENCES magazzini(id)
        )`);
    });
}

// --- ROTTE API ---

// 1. Visualizza tutte le giacenze (Dashboard magazzino)
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

// 2. Crea un nuovo ordine (Utente/Venditore)
app.post('/api/ordini', (req, res) => {
    const { magazzino_id, fornitore, venditore, acquirente, riferimento_fattura, riferimento_deal, data_ordine, prodotti } = req.body;
    
    const query = `INSERT INTO ordini (magazzino_id, fornitore, venditore, acquirente, riferimento_fattura, riferimento_deal, data_ordine, prodotti, stato) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Preso in carico')`;
    
    db.run(query, [magazzino_id, fornitore, venditore, acquirente, riferimento_fattura, riferimento_deal, data_ordine, JSON.stringify(prodotti)], function(err) {
        if (err) return res.status(500).json({ errore: err.message });
        res.json({ id_ordine: this.lastID, messaggio: 'Ordine creato con successo! Notifica visiva attivata.' });
    });
});

// 3. Aggiorna lo stato dell'ordine e gestisce le giacenze (Amministratore)
app.put('/api/ordini/:id/stato', (req, res) => {
    const { stato, metodo_spedizione, confezionamento, tracking } = req.body;
    const ordineId = req.params.id;

    const query = `UPDATE ordini SET stato = ?, metodo_spedizione = ?, confezionamento = ?, tracking = ? WHERE id = ?`;
    
    db.run(query, [stato, metodo_spedizione, confezionamento, tracking, ordineId], function(err) {
        if (err) return res.status(500).json({ errore: err.message });
        
        // Se lo stato diventa "Evaso", qui andrà inserita la logica per scalare le giacenze in automatico
        res.json({ messaggio: `Ordine aggiornato allo stato: ${stato}` });
    });
});

// Avvio del server
app.listen(PORT, () => {
    console.log(`Server avviato sulla porta ${PORT}`);
});