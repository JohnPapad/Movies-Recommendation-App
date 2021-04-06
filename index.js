const express = require("express");
const bodyParser= require('body-parser');
const db = require('better-sqlite3')('moviesDB.sqlite3');
const app = express();
app.use(bodyParser.json());
app.use(express.static("public"));


const handleDBerror = (err) => ({"error": true, "message": err.message});

app.post("/movie", (req, res)=> {
    if (!(req.body && req.body["keyword"])) { // checking if there is payload
        res.sendStatus(400);
        return;
    }
    const keyword = req.body["keyword"];
    if (keyword.trim() === ''){ // checking if payload is whitespace
        res.sendStatus(400);
        return;
    }

    try {
        const result = db.prepare("SELECT * FROM movies WHERE title LIKE ?").all(`%${keyword}%`);
        res.json(result);
    }
    catch(err) {
        res.json(handleDBerror(err));
    }
});

app.get("/movie/:mId", (req, res)=> {
    const mId = req.params["mId"];
    try {
        const result = db.prepare('SELECT * FROM movies WHERE movieId = ?').get(mId);
        res.json([result]);
    }
    catch(err) {
        res.json(handleDBerror(err));
    }
});

app.post("/ratings", (req, res)=> {
    if (!(req.body && req.body["movieList"])) { // checking if there is payload
        res.sendStatus(400);
        return;
    }
    const movieList = req.body["movieList"];
    if (movieList.length === 0) { // checking if movieList is empty
        res.sendStatus(400);
        return;
    }

    let stmt = "SELECT userId, movieId, rating FROM ratings WHERE ";
    for(let i = 0; i < movieList.length-1; i++) { // constructing the query for multiple movieIds
        stmt += "movieId = ? OR ";
    }
    stmt += "movieId = ?";

    try {
        const result = db.prepare(stmt).all(movieList);
        res.json(result);
    }
    catch(err) {
        res.json(handleDBerror(err));
    }
});

app.get("/ratings/:uId", (req, res)=> {
    const uId = req.params["uId"];
    try {
        const result = db.prepare('SELECT movieId, rating FROM ratings WHERE userId = ?').all(uId);
        res.json(result);
    }
    catch(err) {
        res.json(handleDBerror(err));
    }
});

const SERVER_PORT = 3000;
app.listen(SERVER_PORT, (err)=>{ // starting the server on a specific port
    if (err) throw err;

    console.log(`--> Server is up and running on port ${SERVER_PORT}!`);
});