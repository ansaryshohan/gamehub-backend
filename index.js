const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

const cors = require("cors");
require("dotenv").config();
const { dbConnect, client } = require("./dbConnect");
const { ObjectId } = require("mongodb");

app.use(cors());
app.use(express.json());

// DB connection
dbConnect();

async function run() {
  try {
    const gamesCollection = await client.db("gameHub").collection("allGames");

    // get all games data
    app.get("/all-games", async (req, res) => {
      const allGames = await gamesCollection.find({}).toArray();
      return res.json(allGames);
    });
    // get a single game data
    app.get("/game/:id", async (req, res) => {
      const { id } = req.params;
      const gameData = await gamesCollection.findOne({ _id:new ObjectId(id) });
      return res.json(gameData);
    });
    // top games data
    app.get("/top-games", async (req, res) => {
      const topGames = await gamesCollection.find({}).sort({rating:-1}).limit(4).toArray();;
      return res.json(topGames);
    });
  } catch (error) {
    console.log(error);
  }
}

run();

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
